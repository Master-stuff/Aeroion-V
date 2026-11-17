// ============================================================================
// CLOSED-LOOP PID ALTITUDE & 3-SECTOR ATTITUDE PHYSICS ENGINE
// ============================================================================

import {
    sim,
    applyTargetAltitudeState,
    applyPushPerturbationState,
    applyTiltPerturbationState
} from './state.js';

/**
 * Computes EHD thrust in mN for a single collector/emitter sector using Townsend's law.
 * Calibrated so 3 sectors at 23.4 kV produce 31.39 mN (3.20 gf hover).
 */
export function calcSectorThrustMn(vKv) {
    if (vKv <= sim.vOnsetKv) return 0.0;
    return 0.02815 * vKv * (vKv - sim.vOnsetKv);
}

/**
 * Derives display telemetry metrics from the current simulation state.
 */
export function computeTelemetryMetrics() {
    const errCm = sim.zRefCm - sim.zActualCm;
    const echoUs = Math.round((sim.zActualCm * 2) / 0.0343); // Speed of sound 343 m/s
    const pwmPct = Math.round((sim.vCommandKv / sim.vMaxKv) * 100);
    const twRatio = (sim.thrustGf / sim.rocketMassG).toFixed(2);
    const sectorDeltaKv = Math.abs(sim.vSectorB - sim.vSectorA);
    const isLocked = Math.abs(errCm) < 0.6 && Math.abs(sim.tiltAngleDeg - sim.manualTiltBiasDeg) < 0.8;

    return { errCm, echoUs, pwmPct, twRatio, sectorDeltaKv, isLocked };
}

/**
 * Advances PID control, 3-sector voltage allocation, Townsend thrust, and kinematics by dt seconds.
 * Returns UI-relevant event flags without touching DOM or Three.js objects.
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
        if (sim.windTimer <= 0) {
            sim.windTorqueDegS2 = 0.0;
            events.checkHideBanner = true;
        }
    }

    // 3. Closed-Loop Altitude PID Controller (HC-SR04 -> ESP32 -> 28 kV THT)
    const altError = sim.zRefCm - sim.zActualCm;

    if (sim.pidEnabled) {
        // Hover feedforward voltage for 3.20 g rocket is 23.4 kV
        const vFeedForward = sim.zRefCm > 0.2 ? 23.4 : 0.0;
        sim.integralError = Math.max(-8.0, Math.min(8.0, sim.integralError + altError * dt));
        const derivative = (altError - sim.prevError) / Math.max(0.001, dt);
        sim.prevError = altError;

        const kp = 0.65, ki = 0.35, kd = 0.32;
        let vPid = vFeedForward + kp * altError + ki * sim.integralError - kd * sim.zVelocityCmS * 0.15;

        if (sim.zRefCm <= 0.1 && sim.zActualCm < 0.5) {
            vPid = 0.0;
        }
        sim.vCommandKv = Math.max(0.0, Math.min(sim.vMaxKv, vPid));
    } else {
        sim.prevError = altError;
    }

    // 4. 3-Sector Finless Attitude Stabilization (Secteurs A, B, C)
    const targetTilt = sim.manualTiltBiasDeg;
    const tiltError = targetTilt - sim.tiltAngleDeg;

    let diffKv = 0.0;
    if (sim.sectorStabEnabled) {
        // PD controller on attitude: increases voltage on the lower sector to push it back up
        diffKv = tiltError * 0.42 - sim.tiltVelocityDegS * 0.08;
        diffKv = Math.max(-4.5, Math.min(4.5, diffKv));
    } else {
        diffKv = sim.manualTiltBiasDeg * 0.22;
    }

    if (sim.vCommandKv > sim.vOnsetKv) {
        sim.vSectorA = Math.max(sim.vOnsetKv, Math.min(28.0, sim.vCommandKv - diffKv));
        sim.vSectorB = Math.max(sim.vOnsetKv, Math.min(28.0, sim.vCommandKv + diffKv));
        sim.vSectorC = Math.max(sim.vOnsetKv, Math.min(28.0, sim.vCommandKv + Math.abs(diffKv) * 0.15));
    } else {
        sim.vSectorA = sim.vCommandKv;
        sim.vSectorB = sim.vCommandKv;
        sim.vSectorC = sim.vCommandKv;
    }

    // 5. Townsend EHD Thrust Calculation from the 3 Sectors
    const fA = calcSectorThrustMn(sim.vSectorA);
    const fB = calcSectorThrustMn(sim.vSectorB);
    const fC = calcSectorThrustMn(sim.vSectorC);

    sim.thrustMn = fA + fB + fC;
    sim.thrustGf = sim.thrustMn / 9.81;
    sim.currentMa = sim.thrustMn * 0.0198;

    // 6. Vertical Equation of Motion along the Launch Tower Guide Wires
    const weightMn = sim.rocketMassG * 9.81; // 31.392 mN
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

    // 7. Rotational Tilt Dynamics (Corrected by Sector B vs Sector A thrust differential)
    const restoringTorque = (fB - fA) * 14.5;
    const dampingTorque = -sim.tiltVelocityDegS * 5.2;
    const naturalPendulum = (targetTilt - sim.tiltAngleDeg) * (sim.sectorStabEnabled ? 12.0 : 1.5);

    const angularAccel = restoringTorque + dampingTorque + naturalPendulum + sim.windTorqueDegS2;
    sim.tiltVelocityDegS += angularAccel * dt;
    sim.tiltAngleDeg = Math.max(-18.0, Math.min(18.0, sim.tiltAngleDeg + sim.tiltVelocityDegS * dt));

    return events;
}
