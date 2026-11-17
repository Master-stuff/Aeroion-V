// ============================================================================
// THREE.JS 3D SCENE, LAUNCH TOWER, 2-STAGE EHD ROCKET, BENCH & PARTICLE SYSTEM
// ============================================================================

import {
    TOWER_X,
    PARTICLE_COUNT,
    ARC_SPAN,
    SECTOR_ANGLES,
    SUBSYSTEM_DB
} from './config.js';
import { sim } from './state.js';
import {
    createStudioEnvironment,
    createBenchGridTexture,
    createRulerScaleTexture,
    createColorTHTLabelTexture,
    createParticleTexture,
    createMaterials
} from './textures.js';

// ============================================================================
// SCENE, CAMERA, LIGHTS & PBR MATERIALS
// ============================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070f);
scene.fog = new THREE.FogExp2(0x04070f, 0.018);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(0.2, 3.8, 9.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth <= 600 ? 1.35 : (window.innerWidth <= 900 ? 1.6 : 2)));
renderer.shadowMap.enabled = window.innerWidth > 600;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
container.appendChild(renderer.domElement);

scene.environment = createStudioEnvironment(renderer);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.01;
controls.minDistance = 1.8;
controls.maxDistance = 20.0;
controls.target.set(-0.2, 2.0, 0);

// Studio Lights
scene.add(new THREE.AmbientLight(0xdbeafe, 0.65));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(6, 12, 8);
keyLight.castShadow = window.innerWidth > 600;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
rimLight.position.set(-8, 6, -6);
scene.add(rimLight);

// Dynamic Corona Plasma Light on the Rocket
const rocketPlasmaLight = new THREE.PointLight(0xa855f7, 2.0, 7);
rocketPlasmaLight.position.set(-1.4, 2.2, 0);
scene.add(rocketPlasmaLight);

const MAT = createMaterials();

const clickableMeshes = [];
function registerClickable(obj, subKey) {
    obj.userData.subKey = subKey;
    obj.traverse(c => {
        if (c.isMesh) {
            c.userData.subKey = subKey;
            clickableMeshes.push(c);
        }
    });
}

// Laboratory Optical Table
const benchMesh = new THREE.Mesh(
    new THREE.BoxGeometry(12.5, 0.35, 7.8),
    new THREE.MeshStandardMaterial({ map: createBenchGridTexture(), roughness: 0.45, metalness: 0.45 })
);
benchMesh.position.set(0.2, -0.175, 0);
benchMesh.receiveShadow = true;
scene.add(benchMesh);

// ============================================================================
// LAUNCH TOWER (50 CM), GRADUATED RULER, LASER TARGET & HC-SR04 SONAR
// ============================================================================
const launchTowerGroup = new THREE.Group();
launchTowerGroup.position.set(TOWER_X, 0, 0);
scene.add(launchTowerGroup);

// Heavy Anti-Static Launchpad Base
const padBase = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.12, 36), MAT.plaBlack);
padBase.position.set(0, 0.06, 0);
padBase.receiveShadow = true;
launchTowerGroup.add(padBase);

// 3 Insulating Landing Pads around the center HC-SR04 sensor
for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const legPad = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 16), MAT.acrylic);
    legPad.position.set(Math.cos(a) * 0.78, 0.15, Math.sin(a) * 0.78);
    launchTowerGroup.add(legPad);
}

// 2 Vertical Aluminum Gantry Uprights + Top Clear Acrylic Arch
for (const side of [-1.42, 1.42]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.0, 20), MAT.aluBrushed);
    pillar.position.set(side, 2.5, -0.35);
    pillar.castShadow = true;
    launchTowerGroup.add(pillar);
}
const topArch = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.95), MAT.acrylic);
topArch.position.set(0, 5.0, -0.1);
launchTowerGroup.add(topArch);

// 2 Vertical Taut Nylon Guide Wires (passing through the rocket's Teflon guide rings)
for (const gSide of [-0.78, 0.78]) {
    const nylonWire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, 4.88, 8),
        new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.65 })
    );
    nylonWire.position.set(gSide, 2.5, 0);
    launchTowerGroup.add(nylonWire);
}

// Illuminated Graduated Altitude Ruler (0 to 40 cm) on the Left Tower Upright
const rulerBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 4.4, 0.04),
    new THREE.MeshBasicMaterial({ map: createRulerScaleTexture() })
);
rulerBoard.position.set(-1.18, 2.38, -0.32);
launchTowerGroup.add(rulerBoard);

// Marqueur lumineux de consigne Z_ref sur la règle graduée
const setpointMarkerGroup = new THREE.Group();
launchTowerGroup.add(setpointMarkerGroup);

const markerPointer = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.05, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
);
markerPointer.position.set(-1.16, 0, -0.3);
setpointMarkerGroup.add(markerPointer);

// Dashed horizontal laser reference ring showing the target hover altitude plane
const targetRingGeo = new THREE.RingGeometry(0.88, 0.91, 48);
targetRingGeo.rotateX(Math.PI / 2);
const targetLaserRing = new THREE.Mesh(
    targetRingGeo,
    new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
);
setpointMarkerGroup.add(targetLaserRing);

// ----------------------------------------------------------------------------
// HC-SR04 ULTRASONIC ALTITUDE SENSOR (Mounted at Center of Launchpad Base)
// ----------------------------------------------------------------------------
const hcsr04Group = new THREE.Group();
hcsr04Group.position.set(0, 0.14, 0);
launchTowerGroup.add(hcsr04Group);

// Blue PCB (45mm x 20mm scaled) facing straight UP
const hcPcb = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.36), MAT.pcbBlue);
hcPcb.position.set(0, 0.02, 0);
hcsr04Group.add(hcPcb);

// Silver quartz crystal between cylinders
const hcCrystal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.07), MAT.aluMirror);
hcCrystal.position.set(0, 0.05, -0.1);
hcsr04Group.add(hcCrystal);

// Two Iconic Ultrasonic Cylinders (T = Transmitter, R = Receiver) pointing straight UP (+Y)
for (const xCyl of [-0.21, 0.21]) {
    const outerCan = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.22, 28), MAT.aluBrushed);
    outerCan.position.set(xCyl, 0.14, 0);
    hcsr04Group.add(outerCan);

    const darkMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.225, 24),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.4 })
    );
    darkMesh.position.set(xCyl, 0.14, 0);
    hcsr04Group.add(darkMesh);
}

// Animated 3D Ultrasonic Acoustic Wave Rings (Rising Cyan Pulse + Returning Emerald Echo)
const sonarWavesGroup = new THREE.Group();
launchTowerGroup.add(sonarWavesGroup);

const sonarRings = [];
for (let w = 0; w < 5; w++) {
    const isEcho = (w >= 3);
    const rMat = new THREE.MeshBasicMaterial({
        color: isEcho ? 0x10b981 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const rGeo = new THREE.RingGeometry(0.14, 0.18, 32);
    rGeo.rotateX(Math.PI / 2);
    const rMesh = new THREE.Mesh(rGeo, rMat);
    sonarWavesGroup.add(rMesh);
    sonarRings.push({ mesh: rMesh, phase: (w % 3) / 3.0, isEcho });
}

registerClickable(hcsr04Group, 'hcsr04');

// ============================================================================
// THE 2-STAGE EHD ROCKET WITH 3 INDEPENDENT VECTORING SECTORS (A, B, C)
// ============================================================================
const rocketRootGroup = new THREE.Group();
rocketRootGroup.position.set(TOWER_X, 2.38, 0);
scene.add(rocketRootGroup);

// Gimbal pivot inside rocketRootGroup for smooth roll/pitch tilt visualization
const rocketTiltGroup = new THREE.Group();
rocketRootGroup.add(rocketTiltGroup);

// Sub-groups for Exploded View
const noseConeGroup = new THREE.Group();
const upperStageGroup = new THREE.Group(); // Stage 1 (Top Accelerator)
const lowerStageGroup = new THREE.Group(); // Stage 2 (Bottom Main Thruster)
rocketTiltGroup.add(noseConeGroup, upperStageGroup, lowerStageGroup);

// 3 Vertical Balsa Wood Longerons + Aerodynamic Ogive Nosecone
for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const rStrut = 0.76;
    const xS = Math.cos(ang) * rStrut;
    const zS = Math.sin(ang) * rStrut;

    // Vertical Balsa Strut (1.5mm x 1.5mm scaled)
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.036, 1.68, 0.036), MAT.balsa);
    strut.position.set(xS, 0.84, zS);
    strut.castShadow = true;
    upperStageGroup.add(strut);

    // Slanted Balsa Nosecone Ribs converging to top spire
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.95, 8), MAT.balsa);
    rib.position.set(xS * 0.5, 2.02, zS * 0.5);
    rib.lookAt(0, 2.45, 0);
    rib.rotateX(Math.PI / 2);
    noseConeGroup.add(rib);
}

// Aerodynamic Nosecone Tip + Central Balsa Spine
const spireTip = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28, 16), MAT.balsa);
spireTip.position.set(0, 2.45, 0);
noseConeGroup.add(spireTip);

// Bottom Ultrasonic Reflector Target Disc (Lightweight balsa/foil disc at Y = 0.05 so HC-SR04 gets a clean echo)
const sonarTargetDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.015, 24), MAT.balsa);
sonarTargetDisc.position.set(0, 0.06, 0);
lowerStageGroup.add(sonarTargetDisc);

// 2 Teflon Guide Lugs sliding along the vertical nylon threads at X = ±0.78
for (const gSide of [-0.78, 0.78]) {
    const lug = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 10, 20), MAT.acrylic);
    lug.position.set(gSide, 0.85, 0);
    lug.rotation.x = Math.PI / 2;
    upperStageGroup.add(lug);
}

// ----------------------------------------------------------------------------
// BUILD THE 2 STAGES × 3 INDEPENDENT VECTORING SECTORS (SECTEUR A, B, C)
// ----------------------------------------------------------------------------
const sectorGlowMeshes = { A: [], B: [], C: [] };
const sectorSkirtMeshes = [];

const stageConfigs = [
    { grp: upperStageGroup, yBase: 1.18, rTop: 0.68, rBot: 0.74 },
    { grp: lowerStageGroup, yBase: 0.38, rTop: 0.68, rBot: 0.74 }
];

stageConfigs.forEach(st => {
    // Internal Balsa Support Triangle Frame
    const frameRing = new THREE.Mesh(new THREE.TorusGeometry(st.rTop * 0.96, 0.018, 8, 3), MAT.balsa);
    frameRing.position.set(0, st.yBase, 0);
    frameRing.rotation.x = Math.PI / 2;
    frameRing.rotation.z = Math.PI / 6;
    st.grp.add(frameRing);

    // Build the 3 Independent Aluminum Foil Collector Sectors + 3 Independent Corona Emitter Arcs
    SECTOR_ANGLES.forEach(sec => {
        // 1. Curved NACA-profiled Aluminum Foil Sector Skirt (110° arc)
        const skirtGeo = new THREE.CylinderGeometry(
            st.rTop, st.rBot, 0.42, 24, 1, true, sec.startAngle, ARC_SPAN
        );
        const skirtMesh = new THREE.Mesh(skirtGeo, MAT.aluMirror);
        skirtMesh.position.set(0, st.yBase, 0);
        skirtMesh.castShadow = true;
        st.grp.add(skirtMesh);
        sectorSkirtMeshes.push({ mesh: skirtMesh, centerAngle: sec.centerAngle });

        // Rolled smooth aluminum top leading edge for this sector
        const rimArc = new THREE.Mesh(
            new THREE.TorusGeometry(st.rTop, 0.022, 10, 24, ARC_SPAN),
            MAT.aluBrushed
        );
        rimArc.position.set(0, st.yBase + 0.21, 0);
        rimArc.rotation.x = Math.PI / 2;
        rimArc.rotation.z = -sec.startAngle - ARC_SPAN + Math.PI / 2;
        st.grp.add(rimArc);

        // 2. Hair-thin 0.08 mm Copper Corona Emitter Wire Segment (22 mm above collector skirt)
        const wireArc = new THREE.Mesh(
            new THREE.TorusGeometry(st.rTop * 0.96, 0.007, 8, 24, ARC_SPAN),
            MAT.copper
        );
        wireArc.position.set(0, st.yBase + 0.43, 0);
        wireArc.rotation.x = Math.PI / 2;
        wireArc.rotation.z = -sec.startAngle - ARC_SPAN + Math.PI / 2;
        st.grp.add(wireArc);

        // 3. Sector-Specific Violet-Blue Corona Plasma Glow Halo
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xa855f7,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowArc = new THREE.Mesh(
            new THREE.TorusGeometry(st.rTop * 0.96, 0.052, 14, 24, ARC_SPAN),
            glowMat
        );
        glowArc.position.set(0, st.yBase + 0.43, 0);
        glowArc.rotation.x = Math.PI / 2;
        glowArc.rotation.z = -sec.startAngle - ARC_SPAN + Math.PI / 2;
        st.grp.add(glowArc);
        sectorGlowMeshes[sec.id].push(glowArc);
    });
});

registerClickable(noseConeGroup, 'rocket');
registerClickable(upperStageGroup, 'rocket');
registerClickable(lowerStageGroup, 'sectors');

// ----------------------------------------------------------------------------
// 3D VISUAL PERTURBATION ROD ("BAGUETTE DU JURY")
// ----------------------------------------------------------------------------
const juryRodGroup = new THREE.Group();
juryRodGroup.visible = false;
scene.add(juryRodGroup);

// Insulating Acrylic Rod pushing down on the rocket nosecone
const rodShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 2.2, 16),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 })
);
rodShaft.position.set(0, 1.2, 0.6);
rodShaft.rotation.x = 0.6;
juryRodGroup.add(rodShaft);

const pushCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.28, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
);
pushCone.position.set(0, 0.15, 0);
pushCone.rotation.x = Math.PI;
juryRodGroup.add(pushCone);

// ============================================================================
// RIGHT SIDE OF BENCH: LARGE COLOR TV THT (28 kV), 10MΩ BALLAST & ESP32 PID
// ============================================================================
const powerBenchGroup = new THREE.Group();
scene.add(powerBenchGroup);

// A. Large Color TV Flyback Transformer (14"-29", 24-28 kV DC with FOCUS & SCREEN Knobs)
const tht28Group = new THREE.Group();
tht28Group.position.set(2.15, 0, -0.45);
powerBenchGroup.add(tht28Group);

// Molded base & main HV potted black tower
const thtBaseBlock = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.22, 1.15), MAT.plaBlack);
thtBaseBlock.position.set(0, 0.11, 0);
tht28Group.add(thtBaseBlock);

const thtMainTower = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 1.65, 36), MAT.plaBlack);
thtMainTower.position.set(0.1, 0.95, 0);
thtMainTower.castShadow = true;
tht28Group.add(thtMainTower);

// Authentic 28 kV Color TV THT Technical Label on cylinder front
const thtSticker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.585, 0.585, 0.65, 32, 1, true, -0.65, 1.3),
    new THREE.MeshBasicMaterial({ map: createColorTHTLabelTexture(), side: THREE.DoubleSide })
);
thtSticker.position.set(0.1, 1.0, 0);
tht28Group.add(thtSticker);

// Side Focus / Screen Bleeder Box with the 2 Iconic Rotary Knobs (FOCUS & SCREEN)
const focusBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.15, 0.52), MAT.plaBlack);
focusBox.position.set(0.52, 0.85, 0.22);
tht28Group.add(focusBox);

for (let kIdx = 0; kIdx < 2; kIdx++) {
    const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.14, 20),
        new THREE.MeshStandardMaterial({ color: kIdx === 0 ? 0xe2e8f0 : 0xef4444, roughness: 0.3 })
    );
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.74, 1.12 - kIdx * 0.45, 0.22);
    tht28Group.add(knob);
}

// Exposed Large U-Shaped Ferrite Core + 5 Primary Turns of Insulated Wire
const largeFerrite = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.72, 0.78), MAT.ferrite);
largeFerrite.position.set(-0.46, 0.98, 0);
tht28Group.add(largeFerrite);

for (let t = 0; t < 5; t++) {
    const turn = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.03, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 })
    );
    turn.position.set(-0.56, 0.62 + t * 0.15, 0);
    turn.rotation.x = Math.PI / 2;
    tht28Group.add(turn);
}

// Large Finned Aluminum Heatsink + Power Switching Transistor (BU508 / IRFP250) next to THT
const hsPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 1.05), MAT.aluBrushed);
hsPlate.position.set(1.15, 0.65, -0.45);
hsPlate.castShadow = true;
tht28Group.add(hsPlate);

for (let f = -3; f <= 3; f++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.22, 0.035), MAT.aluBrushed);
    fin.position.set(1.32, 0.65, -0.45 + f * 0.14);
    tht28Group.add(fin);
}

// Thick Red Silicone 28 kV Anode Cable arching from top of THT to the 10 MOhm Ballast Chain
const hvAnodeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, 1.78, 0),
    new THREE.Vector3(0.0, 2.25, 0.2),
    new THREE.Vector3(-0.55, 1.6, 0.45),
    new THREE.Vector3(-1.0, 0.85, 0.6)
]);
const hvAnodeCable = new THREE.Mesh(new THREE.TubeGeometry(hvAnodeCurve, 32, 0.045, 14, false), MAT.hvRed);
hvAnodeCable.castShadow = true;
tht28Group.add(hvAnodeCable);

registerClickable(tht28Group, 'tht28');

// B. 10 × 1 MOhm Safety Ballast Resistor Chain inside Clear Acrylic Tube
const ballastGroup = new THREE.Group();
ballastGroup.position.set(1.15, 0.85, 0.15);
powerBenchGroup.add(ballastGroup);

for (const zP of [-0.65, 0.65]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.85, 16), MAT.acrylic);
    post.position.set(0, -0.425, zP);
    ballastGroup.add(post);
}

const acrylicTube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.55, 24, 1, true), MAT.acrylic);
acrylicTube.rotation.x = Math.PI / 2;
ballastGroup.add(acrylicTube);

for (let r = 0; r < 10; r++) {
    const res = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.1, 16), MAT.resistorOrange);
    res.position.set(0, 0, -0.63 + r * 0.14);
    res.rotation.x = Math.PI / 2;
    ballastGroup.add(res);
}

registerClickable(ballastGroup, 'ballast');

// C. ESP32 PID Controller + 3-Way High-Voltage Sector Distributor (Secteurs A, B, C)
const espControlGroup = new THREE.Group();
espControlGroup.position.set(1.95, 0, 1.55);
powerBenchGroup.add(espControlGroup);

const mainControlBoard = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 1.35), MAT.pcbDark);
mainControlBoard.position.set(0, 0.06, 0);
espControlGroup.add(mainControlBoard);

const esp32Mod = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.5), MAT.plaBlack);
esp32Mod.position.set(0.32, 0.14, -0.2);
espControlGroup.add(esp32Mod);

const espCan = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.4), MAT.aluBrushed);
espCan.position.set(0.25, 0.19, -0.2);
espControlGroup.add(espCan);

// 3 Glowing Sector Indicator LEDs on the 3-Way Distributor (Secteur A, B, C)
const sectorLeds = [];
const ledColors = [0x38bdf8, 0xa855f7, 0x10b981];
for (let sIdx = 0; sIdx < 3; sIdx++) {
    const lMat = new THREE.MeshBasicMaterial({ color: ledColors[sIdx] });
    const lMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), lMat);
    lMesh.position.set(-0.55, 0.16, -0.35 + sIdx * 0.35);
    espControlGroup.add(lMesh);
    sectorLeds.push(lMesh);
}

registerClickable(espControlGroup, 'esp32');

// Dynamic Ultra-Fine Copper Tether Bundle connecting Ballast/Distributor to the Flying Rocket
const tetherGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(1.15, 0.85, 0.88),
    new THREE.Vector3(-0.1, 1.1, 0.4),
    new THREE.Vector3(TOWER_X, 2.38, 0)
]);
const tetherLine = new THREE.Line(
    tetherGeo,
    new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.82 })
);
scene.add(tetherLine);

// ============================================================================
// 3-SECTOR IONIC WIND PARTICLE JETS (A, B, C)
// ============================================================================
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pColors = new Float32Array(PARTICLE_COUNT * 3);
const pPhases = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPhases[i] = Math.random();
    const c1 = new THREE.Color(0xc084fc);
    const c2 = new THREE.Color(0x38bdf8);
    const mixed = c1.lerp(c2, pPhases[i]);
    pColors[i * 3] = mixed.r;
    pColors[i * 3 + 1] = mixed.g;
    pColors[i * 3 + 2] = mixed.b;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

const particleSystem = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
        size: 0.1,
        map: createParticleTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);
scene.add(particleSystem);

// ============================================================================
// CAMERA TRANSITIONS, RESIZE & RAYCASTER INTERACTION
// ============================================================================
let camTween = null;

export function animateCam(pos, target) {
    camTween = {
        sPos: camera.position.clone(),
        ePos: new THREE.Vector3(pos.x, pos.y, pos.z),
        sTar: controls.target.clone(),
        eTar: new THREE.Vector3(target.x, target.y, target.z),
        t: 0
    };
}

export function focusSubsystemCamera(subKey) {
    const info = SUBSYSTEM_DB[subKey];
    if (!info) return;
    const lookY = (subKey === 'rocket' || subKey === 'sectors') ? rocketRootGroup.position.y + 0.9 : info.lookAt.y;
    animateCam(
        { x: info.camPos.x, y: (subKey === 'rocket' || subKey === 'sectors') ? lookY + 0.7 : info.camPos.y, z: info.camPos.z },
        { x: info.lookAt.x, y: lookY, z: info.lookAt.z }
    );
}

function resize3DScene() {
    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width <= 600 ? 1.35 : (width <= 900 ? 1.6 : 2)));
    renderer.setSize(width, height, false);
}

export function initScene(onSelectSubsystem) {
    // Raycaster for direct 3D clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downPt = { x: 0, y: 0 };

    renderer.domElement.addEventListener('pointerdown', e => {
        downPt = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', e => {
        if (Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 6) return;
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(clickableMeshes, false);
        if (hits.length > 0 && hits[0].object.userData.subKey) {
            onSelectSubsystem(hits[0].object.userData.subKey);
        }
    });

    window.addEventListener('resize', resize3DScene, { passive: true });
    if (window.ResizeObserver) {
        const sceneResizeObserver = new ResizeObserver(resize3DScene);
        sceneResizeObserver.observe(container);
    }
}

export function updateCameraAndControls(dt) {
    if (camTween) {
        camTween.t += dt * 2.4;
        const p = Math.min(1.0, camTween.t);
        const ease = 1 - Math.pow(1 - p, 3);
        camera.position.lerpVectors(camTween.sPos, camTween.ePos, ease);
        controls.target.lerpVectors(camTween.sTar, camTween.eTar, ease);
        if (p >= 1.0) camTween = null;
    }
    controls.update();
}

export function updateSceneVisuals(dt, elapsed) {
    // Active Jury Rod visual sync
    juryRodGroup.visible = sim.juryRodVisible;
    if (sim.juryRodVisible) {
        juryRodGroup.position.set(TOWER_X, rocketRootGroup.position.y + 2.35, 0);
    }

    // Map Physics to 3D Scene Positions & Glow Intensities
    // Scale: 0 cm = Y: 0.38 on tower; 40 cm = Y: 4.02 on tower (0.091 world units per cm)
    const worldRocketY = 0.38 + sim.zActualCm * 0.091 + (sim.zActualCm > 0.5 ? Math.sin(elapsed * 4.5) * 0.012 : 0);
    rocketRootGroup.position.y = worldRocketY;
    rocketPlasmaLight.position.y = worldRocketY + 1.0;

    // Update laser target marker on the graduated ruler
    setpointMarkerGroup.position.y = 0.38 + sim.zRefCm * 0.091;

    // Apply tilt angle to rocketTiltGroup
    rocketTiltGroup.rotation.z = THREE.MathUtils.degToRad(-sim.tiltAngleDeg);

    // Update dynamic HV copper tether curve
    tetherGeo.setFromPoints([
        new THREE.Vector3(1.15, 0.85, 0.88),
        new THREE.Vector3(-0.1, worldRocketY * 0.55 + 0.25, 0.38),
        new THREE.Vector3(TOWER_X, worldRocketY + 0.45, 0)
    ]);

    // Update per-sector Corona Plasma Halo opacity & color brightness
    const setSectorGlow = (id, kv) => {
        const ratio = kv > sim.vOnsetKv ? Math.min(1.0, (kv - sim.vOnsetKv) / (28.0 - sim.vOnsetKv)) : 0.0;
        sectorGlowMeshes[id].forEach(m => {
            m.material.opacity = ratio * 0.92;
            m.scale.setScalar(0.95 + ratio * 0.35);
        });
    };
    setSectorGlow('A', sim.vSectorA);
    setSectorGlow('B', sim.vSectorB);
    setSectorGlow('C', sim.vSectorC);

    rocketPlasmaLight.intensity = (sim.vCommandKv > sim.vOnsetKv)
        ? ((sim.vCommandKv - sim.vOnsetKv) / 20.0) * 2.4
        : 0.0;

    // Animate HC-SR04 Ultrasonic Acoustic Wave Rings (Upward Ping & Downward Echo)
    if (sim.showSonar) {
        const rocketBottomY = Math.max(0.42, rocketRootGroup.position.y);
        sonarRings.forEach(sr => {
            sr.phase = (sr.phase + dt * 1.15) % 1.0;
            const p = sr.phase;
            if (!sr.isEcho) {
                // Rising ultrasonic ping from HC-SR04 (Y=0.28) to Rocket bottom
                sr.mesh.position.y = THREE.MathUtils.lerp(0.28, rocketBottomY, p);
                sr.mesh.scale.setScalar(0.6 + p * 1.6);
                sr.mesh.material.opacity = (1.0 - p) * 0.65;
            } else {
                // Reflected echo travelling back down from Rocket bottom to HC-SR04
                sr.mesh.position.y = THREE.MathUtils.lerp(rocketBottomY, 0.28, p);
                sr.mesh.scale.setScalar(1.8 - p * 1.1);
                sr.mesh.material.opacity = (1.0 - p) * 0.55;
            }
        });
    }

    // Animate 3-Sector Ionic Wind Particles (Velocity & Density proportional to each Sector's kV)
    const posAttr = pGeo.attributes.position;
    const activeThrust = sim.thrustMn > 1.0;
    particleSystem.visible = activeThrust;

    if (activeThrust) {
        const tiltRad = THREE.MathUtils.degToRad(sim.tiltAngleDeg);
        const sectorKvList = [sim.vSectorA, sim.vSectorB, sim.vSectorC];

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const secIdx = i % 3; // 0 = Sector A, 1 = Sector B, 2 = Sector C
            const secKv = sectorKvList[secIdx];
            const speedMult = Math.max(0.2, (secKv - sim.vOnsetKv) / 14.0);

            pPhases[i] += dt * speedMult * (1.2 + (i % 5) * 0.15);
            if (pPhases[i] > 1.0) pPhases[i] -= 1.0;

            const prog = pPhases[i];
            const secConf = SECTOR_ANGLES[secIdx];
            const localAngle = secConf.startAngle + ((i * 0.618034) % 1.0) * ARC_SPAN;
            const r = 0.65 + (i % 4) * 0.03;

            const yStart = rocketRootGroup.position.y + (i % 2 === 0 ? 1.55 : 0.78);
            const dropDist = prog * (1.1 + speedMult * 0.9);
            const y = Math.max(0.14, yStart - dropDist);

            const xLocal = Math.cos(localAngle) * r + Math.sin(tiltRad) * dropDist;
            const zLocal = Math.sin(localAngle) * r;

            posAttr.array[i * 3] = TOWER_X + xLocal;
            posAttr.array[i * 3 + 1] = y;
            posAttr.array[i * 3 + 2] = zLocal;
        }
        posAttr.needsUpdate = true;
    }
}

export function renderScene() {
    renderer.render(scene, camera);
}

export function applyExplodedView(explodedFactor) {
    const e = explodedFactor;

    // Vertically separate Nosecone, Upper Stage 1 and Lower Stage 2
    noseConeGroup.position.y = e * 0.75;
    upperStageGroup.position.y = e * 0.25;
    lowerStageGroup.position.y = -e * 0.35;

    // Radially expand the 3 Aluminum Collector Sectors (A, B, C) to showcase the 3-sector architecture
    sectorSkirtMeshes.forEach(({ mesh, centerAngle }) => {
        const radOut = e * 0.28;
        mesh.position.x = Math.cos(centerAngle) * radOut;
        mesh.position.z = Math.sin(centerAngle) * radOut;
    });
}

export function setSonarVisibility(visible) {
    sonarWavesGroup.visible = visible;
}

export function getRocketPosition() {
    return rocketRootGroup.position;
}

export function projectWorldToScreen(offset, followRocket) {
    const pos = new THREE.Vector3(offset.x, offset.y, offset.z);
    if (followRocket) {
        pos.x += rocketRootGroup.position.x;
        pos.y += rocketRootGroup.position.y;
        pos.z += rocketRootGroup.position.z;
    }
    pos.project(camera);
    if (pos.z > 1 || pos.z < -1 || pos.x < -1 || pos.x > 1 || pos.y < -1 || pos.y > 1) {
        return null;
    }
    return {
        x: (pos.x * 0.5 + 0.5) * window.innerWidth,
        y: (-(pos.y * 0.5) + 0.5) * window.innerHeight
    };
}
