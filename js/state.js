// ============================================================================
// CLOSED-LOOP PID & MULTIPHYSICS SIMULATION STATE
// ============================================================================

import { DEFAULT_PID, DEFAULT_PHYSICS } from './config.js';

export const sim = {
    // Altitude Setpoint & Actual Kinematics (in cm, 0 to 37.5 cm)
    zRefCm: 22.0,
    zActualCm: 22.0,
    zVelocityCmS: 0.0,
    integralError: 0.0,
    prevError: 0.0,

    // Tunable PID Gains
    kp: DEFAULT_PID.kp,
    ki: DEFAULT_PID.ki,
    kd: DEFAULT_PID.kd,

    // Control Modes
    pidEnabled: true,
    sectorStabEnabled: true,
    autoDemo: false,
    autoDemoTimer: 0.0,

    // High Voltage & Thrust Physics (Large Color TV THT: 0 to 28.0 kV)
    gapMm: DEFAULT_PHYSICS.gapMm,  // Inter-electrode corona gap d (mm)
    vOnsetKv: 7.4,                 // Corona onset voltage scaled by gapMm
    vMaxKv: 28.0,                  // Max output of large Color TV THT
    vCommandKv: 23.4,              // Base voltage commanded by PID or Manual slider
    vSectorA: 23.4,                // Sector A (Front-Left) kV
    vSectorB: 23.4,                // Sector B (Front-Right) kV
    vSectorC: 23.4,                // Sector C (Rear) kV
    rocketMassG: DEFAULT_PHYSICS.rocketMassG, // 2-stage balsa rocket mass (g)
    thrustMn: 31.4,                // Total vertical thrust in mN (31.39 mN = 3.20 gf hover)
    thrustGf: 3.20,
    currentMa: 0.62,

    // 2-Axis Attitude (Roll X-tilt & Pitch Z-tilt in degrees) & External Perturbations
    tiltAngleDeg: 0.0,
    tiltVelocityDegS: 0.0,
    manualTiltBiasDeg: 0.0,
    pitchAngleDeg: 0.0,
    pitchVelocityDegS: 0.0,
    manualPitchBiasDeg: 0.0,
    unstablePhase: 0.0,

    pushForceCmS2: 0.0,            // Downward perturbation from jury rod push
    pushTimer: 0.0,
    windTorqueDegS2: 0.0,          // Lateral wind gust roll torque
    windPitchTorqueDegS2: 0.0,     // Lateral wind gust pitch torque
    windTimer: 0.0,
    juryRodVisible: false,
    windGustVisible: false,

    // Visual, Oscilloscope & Audio Options
    explodedFactor: 0.0,
    showSonar: true,
    showLabels: true,
    activeSubsystemKey: 'rocket',
    oscPaused: false,
    oscHoverIndex: -1,
    audioEnabled: false,

    // Oscilloscope Rolling History (120 samples)
    histZRef: new Array(120).fill(22.0),
    histZAct: new Array(120).fill(22.0),
    histKv: new Array(120).fill(23.4),
    histTilt: new Array(120).fill(0.0)
};

export function applyTargetAltitudeState(cm) {
    sim.zRefCm = cm;
}

export function applyPushPerturbationState() {
    const zRefUpdated = sim.zActualCm < 5.0;
    if (zRefUpdated) {
        sim.zRefCm = 22.0;
    }
    sim.pushForceCmS2 = -135.0; // Strong downward push with insulating rod
    sim.pushTimer = 1.15;
    sim.juryRodVisible = true;
    return { zRefUpdated };
}

export function applyTiltPerturbationState() {
    sim.windTorqueDegS2 = 195.0;       // Sharp lateral gust rolling the rocket (+X lower)
    sim.windPitchTorqueDegS2 = -135.0; // Pitch coupling engaging Sector C
    sim.windTimer = 0.85;
    sim.windGustVisible = true;
}

export function resetPIDGainsState() {
    sim.kp = DEFAULT_PID.kp;
    sim.ki = DEFAULT_PID.ki;
    sim.kd = DEFAULT_PID.kd;
    sim.rocketMassG = DEFAULT_PHYSICS.rocketMassG;
    sim.gapMm = DEFAULT_PHYSICS.gapMm;
    sim.vOnsetKv = 7.4;
}

export function pushOscilloscopeSample() {
    if (sim.oscPaused) return;
    sim.histZRef.push(sim.zRefCm);
    sim.histZRef.shift();
    sim.histZAct.push(sim.zActualCm);
    sim.histZAct.shift();
    sim.histKv.push(sim.vCommandKv);
    sim.histKv.shift();
    sim.histTilt.push(Math.hypot(sim.tiltAngleDeg, sim.pitchAngleDeg));
    sim.histTilt.shift();
}
