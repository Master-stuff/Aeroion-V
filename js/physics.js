// ============================================================================
// CLOSED-LOOP PID ALTITUDE & 2-AXIS 3-SECTOR ATTITUDE PHYSICS ENGINE
// ============================================================================

import { SECTOR_ANGLES } from './config.js';
import {
    sim,
    applyTargetAltitudeState,
    applyPushPerturbationState,
    applyTiltPerturbationState
} from './state.js';

/**
 * Computes EHD thrust in mN for a single collector/emitter sector using Townsend's law.
 * Scales corona onset and mobility by the inter-electrode gap d (nominal 22 mm).
 * Calibrated so 3 sectors at 23.4 kV & 22 mm produce 31.39 mN (3.20 gf hover).
 */
export function calcSectorThrustMn(vKv) {
    const vOnset = 7.4 * (sim.gapMm / 22.0);
    sim.vOnsetKv = vOnset;
    if (vKv <= vOnset) return 0.0;
    const gapFactor = 22.0 / sim.gapMm;
    return 0.02815 * gapFactor * vKv * (vKv - vOnset);
}

/**
 * Derives display telemetry metrics from the current simulation state.
 */
export function computeTelemetryMetrics() {
    const errCm = sim.zRefCm - sim.zActualCm;
    const echoUs = Math.round((sim.zActualCm * 2) / 0.0343); // Speed of sound 343 m/s
    const pwmPct = Math.round((sim.vCommandKv / sim.vMaxKv) * 100);
    const twRatio = (sim.thrustGf / sim.rocketMassG).toFixed(2);
    const sectorDeltaKv = Math.max(sim.vSectorA, sim.vSectorB, sim.vSectorC) -
        Math.min(sim.vSectorA, sim.vSectorB, sim.vSectorC);
    const totalTiltDeg = Math.hypot(sim.tiltAngleDeg, sim.pitchAngleDeg);
    const errTilt = Math.hypot(
        sim.tiltAngleDeg - sim.manualTiltBiasDeg,
        sim.pitchAngleDeg - sim.manualPitchBiasDeg
    );
    const isLocked = Math.abs(errCm) < 0.6 && errTilt < 0.8;

    return { errCm, echoUs, pwmPct, twRatio, sectorDeltaKv, totalTiltDeg, isLocked };
}

/**
 * Advances PID control, 2-axis 3-sector voltage allocation, Townsend thrust,
 * and kinematics by dt seconds. Returns UI event flags without touching DOM/Three.js.
 */
export function stepPhysics(dt) {
    const events = {
        zRefChanged: false,
        perturbationTriggered: null,
        checkHideBanner: false
    };

    // 1. Optional Autonomous Demo Sequence
    if (sim.autoDemo) {
        sim.autoDemoTimer += dt;
        const phase = sim.autoDemoTimer % 16.0;
        if (phase < 4.0) {
            if (sim.zRefCm !== 24.0) {
                applyTargetAltitudeState(24.0);
                events.zRefChanged = true;
            }
        } else if (phase >= 4.0 && phase < 4.2 && sim.pushTimer <= 0) {
            const { zRefUpdated } = applyPushPerturbationState();
            if (zRefUpdated) events.zRefChanged = true;
            events.perturbationTriggered = 'push';
        } else if (phase >= 8.5 && phase < 8.7 && sim.windTimer <= 0) {
            applyTiltPerturbationState();
            events.perturbationTriggered = 'tilt';
        } else if (phase >= 12.5) {
            if (sim.zRefCm !== 15.0) {
                applyTargetAltitudeState(15.0);
                events.zRefChanged = true;
            }
        }
    }

    // 2. Active Perturbation Timers ("Baguette du Jury" & "Rafale Latérale")
    if (sim.pushTimer > 0) {
        sim.pushTimer -= dt;
        sim.juryRodVisible = true;
        if (sim.pushTimer <= 0) {
            sim.pushForceCmS2 = 0.0;
            sim.juryRodVisible = false;
            events.checkHideBanner = true;
        }
    }

    if (sim.windTimer > 0) {
        sim.windTimer -= dt;
        sim.windGustVisible = true;
        if (sim.windTimer <= 0) {
            sim.windTorqueDegS2 = 0.0;
            sim.windPitchTorqueDegS2 = 0.0;
            sim.windGustVisible = false;
            events.checkHideBanner = true;
        }
    }

    // Update effective onset voltage for current gapMm
    sim.vOnsetKv = 7.4 * (sim.gapMm / 22.0);

    // 3. Closed-Loop Altitude PID Controller (HC-SR04 -> ESP32 -> 28 kV THT)
    const altError = sim.zRefCm - sim.zActualCm;

    if (sim.pidEnabled) {
        // Hover feedforward voltage for nominal 3.20 g / 22 mm rocket is 23.4 kV
        const vFeedForward = sim.zRefCm > 0.2 ? 23.4 : 0.0;
        sim.integralError = Math.max(-8.0, Math.min(8.0, sim.integralError + altError * dt));
        sim.prevError = altError;

        let vPid = vFeedForward + sim.kp * altError + sim.ki * sim.integralError - sim.kd * sim.zVelocityCmS * 0.15;

        if (sim.zRefCm <= 0.1 && sim.zActualCm < 0.5) {
            vPid = 0.0;
        }
        sim.vCommandKv = Math.max(0.0, Math.min(sim.vMaxKv, vPid));
    } else {
        sim.prevError = altError;
    }

    // 4. 2-Axis 3-Sector Finless Attitude Stabilization (Secteurs A, B, C at 120°)
    const errX = sim.manualTiltBiasDeg - sim.tiltAngleDeg;
    const rateX = -sim.tiltVelocityDegS;
    const errZ = sim.manualPitchBiasDeg - sim.pitchAngleDeg;
    const rateZ = -sim.pitchVelocityDegS;

    const sectorVoltages = {};
    for (const sec of SECTOR_ANGLES) {
        let dV = 0.0;
        if (sim.sectorStabEnabled) {
            const projErr = sec.ux * errX + sec.uz * errZ;
            const projRate = sec.ux * rateX + sec.uz * rateZ;
            dV = Math.max(-4.8, Math.min(4.8, -(projErr * 0.48 + projRate * 0.09)));
        } else {
            dV = -(sec.ux * sim.manualTiltBiasDeg + sec.uz * sim.manualPitchBiasDeg) * 0.22;
        }

        if (sim.vCommandKv > sim.vOnsetKv) {
            sectorVoltages[sec.id] = Math.max(sim.vOnsetKv, Math.min(sim.vMaxKv, sim.vCommandKv + dV));
        } else {
            sectorVoltages[sec.id] = sim.vCommandKv;
        }
    }

    sim.vSectorA = sectorVoltages.A;
    sim.vSectorB = sectorVoltages.B;
    sim.vSectorC = sectorVoltages.C;

    // 5. Townsend EHD Thrust Calculation from the 3 Sectors
    const fA = calcSectorThrustMn(sim.vSectorA);
    const fB = calcSectorThrustMn(sim.vSectorB);
    const fC = calcSectorThrustMn(sim.vSectorC);

    sim.thrustMn = fA + fB + fC;
    sim.thrustGf = sim.thrustMn / 9.81;
    sim.currentMa = sim.thrustMn * 0.0198;

    // 6. Vertical Equation of Motion along the Launch Tower Guide Wires
    const weightMn = sim.rocketMassG * 9.81;
    const netForceMn = sim.thrustMn - weightMn;
    const verticalAccelCmS2 = (netForceMn / sim.rocketMassG) * 18.0 - sim.zVelocityCmS * 2.6 + sim.pushForceCmS2;

    sim.zVelocityCmS += verticalAccelCmS2 * dt;
    sim.zActualCm += sim.zVelocityCmS * dt;

    // Clamp between launchpad (0 cm) and gantry ceiling (37.5 cm)
    if (sim.zActualCm <= 0.0) {
        sim.zActualCm = 0.0;
        if (sim.zVelocityCmS < 0) sim.zVelocityCmS = 0.0;
    } else if (sim.zActualCm >= 37.5) {
        sim.zActualCm = 37.5;
        if (sim.zVelocityCmS > 0) sim.zVelocityCmS = 0.0;
    }

    // 7. 2-Axis Rotational Tilt Dynamics (3-sector vectoring + unstabilized EHD wobble)
    const fBySector = [fA, fB, fC];
    let torqueX = 0.0;
    let torqueZ = 0.0;
    for (let i = 0; i < SECTOR_ANGLES.length; i++) {
        torqueX -= SECTOR_ANGLES[i].ux * fBySector[i] * 18.5;
        torqueZ -= SECTOR_ANGLES[i].uz * fBySector[i] * 18.5;
    }

    // Aero-electrostatic instability excitation when 3-sector control is OFF
    let wobbleX = 0.0;
    let wobbleZ = 0.0;
    if (!sim.sectorStabEnabled && sim.zActualCm > 1.0 && sim.thrustMn > 5.0) {
        sim.unstablePhase += dt;
        wobbleX = Math.sin(sim.unstablePhase * 5.2) * 32.0;
        wobbleZ = Math.cos(sim.unstablePhase * 3.7) * 26.0;
    }

    const dampingX = -sim.tiltVelocityDegS * (sim.sectorStabEnabled ? 5.2 : 1.6);
    const dampingZ = -sim.pitchVelocityDegS * (sim.sectorStabEnabled ? 5.2 : 1.6);
    const guideRestoreX = (sim.manualTiltBiasDeg - sim.tiltAngleDeg) * (sim.sectorStabEnabled ? 3.0 : 0.9);
    const guideRestoreZ = (sim.manualPitchBiasDeg - sim.pitchAngleDeg) * (sim.sectorStabEnabled ? 3.0 : 0.9);

    const angularAccelX = torqueX + dampingX + guideRestoreX + sim.windTorqueDegS2 + wobbleX;
    const angularAccelZ = torqueZ + dampingZ + guideRestoreZ + sim.windPitchTorqueDegS2 + wobbleZ;

    sim.tiltVelocityDegS += angularAccelX * dt;
    sim.pitchVelocityDegS += angularAccelZ * dt;

    sim.tiltAngleDeg = Math.max(-18.0, Math.min(18.0, sim.tiltAngleDeg + sim.tiltVelocityDegS * dt));
    sim.pitchAngleDeg = Math.max(-18.0, Math.min(18.0, sim.pitchAngleDeg + sim.pitchVelocityDegS * dt));

    return events;
}
