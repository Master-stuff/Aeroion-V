// ============================================================================
// CLOSED-LOOP PID & MULTIPHYSICS SIMULATION STATE
// ============================================================================

export const sim = {
    // Altitude Setpoint & Actual Kinematics (in cm, 0 to 38 cm)
    zRefCm: 22.0,
    zActualCm: 22.0,
    zVelocityCmS: 0.0,
    integralError: 0.0,
    prevError: 0.0,

    // Control Modes
    pidEnabled: true,
    sectorStabEnabled: true,
    autoDemo: false,
    autoDemoTimer: 0.0,

    // High Voltage & Thrust Physics (Large Color TV THT: 0 to 28.0 kV)
    vOnsetKv: 7.4,            // Corona onset voltage for d = 22 mm
    vMaxKv: 28.0,             // Max output of large Color TV THT
    vCommandKv: 23.4,         // Base voltage commanded by PID or Manual slider
    vSectorA: 23.4,           // Sector A (Front-Left) kV
    vSectorB: 23.4,           // Sector B (Front-Right) kV
    vSectorC: 23.4,           // Sector C (Rear) kV
    rocketMassG: 3.20,        // 3.20 grams 2-stage balsa rocket
    thrustMn: 31.4,           // Total vertical thrust in mN (31.39 mN = 3.20 gf hover)
    thrustGf: 3.20,
    currentMa: 0.62,

    // Attitude (Roll/Pitch Tilt Angle in degrees) & External Perturbations
    tiltAngleDeg: 0.0,        // Current rocket tilt angle
    tiltVelocityDegS: 0.0,
    manualTiltBiasDeg: 0.0,
    pushForceCmS2: 0.0,       // Downward perturbation from jury rod push
    pushTimer: 0.0,
    windTorqueDegS2: 0.0,     // Lateral wind gust torque
    windTimer: 0.0,
    juryRodVisible: false,

    // Visual Options
    explodedFactor: 0.0,
    showSonar: true,
    showLabels: true,
    activeSubsystemKey: 'rocket',

    // Oscilloscope Rolling History (120 samples)
    histZRef: new Array(120).fill(22.0),
    histZAct: new Array(120).fill(22.0),
    histKv: new Array(120).fill(23.4)
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
    sim.windTorqueDegS2 = 195.0; // Sharp lateral gust tilting the rocket
    sim.windTimer = 0.85;
}

export function pushOscilloscopeSample() {
    sim.histZRef.push(sim.zRefCm);
    sim.histZRef.shift();
    sim.histZAct.push(sim.zActualCm);
    sim.histZAct.shift();
    sim.histKv.push(sim.vCommandKv);
    sim.histKv.shift();
}
