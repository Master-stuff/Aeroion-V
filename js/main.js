// ============================================================================
// APPLICATION ENTRY POINT & 60 FPS RENDER / MULTIPHYSICS ANIMATION LOOP
// ============================================================================

import { sim } from './state.js';
import { stepPhysics } from './physics.js';
import {
    initScene,
    updateCameraAndControls,
    updateSceneVisuals,
    renderScene
} from './scene3d.js';
import {
    initUI,
    selectSubsystem,
    syncPhysicsUIEvents,
    updateTelemetryAndOscilloscope,
    update3DLabels
} from './ui.js';
import { updateCoronaAudio } from './audio.js';

initUI();
initScene(selectSubsystem);

const clock = new THREE.Clock();
let uiTick = 0;

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    // 1. Camera Tweening
    updateCameraAndControls(dt);

    // 2. Step Closed-Loop PID & 2-Axis 3-Sector Attitude Physics
    const physicsEvents = stepPhysics(dt);
    syncPhysicsUIEvents(physicsEvents);

    // 3. Update 3D Rocket, Corona Curtains, ESP32 LEDs, Wind Gusts & Particles
    updateSceneVisuals(dt, elapsed);

    // 4. Update Procedural Corona Audio (if enabled)
    updateCoronaAudio();

    // 5. Update UI & Oscilloscope at ~20 Hz
    uiTick++;
    if (uiTick % 3 === 0) {
        updateTelemetryAndOscilloscope();
    }

    // 6. Project 3D Floating Labels (with cached layout rects)
    update3DLabels();

    renderScene();
}

window.addEventListener('load', () => {
    if (window.innerWidth <= 900) {
        sim.activeSubsystemKey = 'rocket';
    }
    updateTelemetryAndOscilloscope();
    animate();
});
