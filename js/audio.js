// ============================================================================
// PROCEDURAL WEB AUDIO CORONA HISS & 25 KHZ FLYBACK TRANSFORMER SYNTHESIZER
// ============================================================================

import { sim } from './state.js';

let audioCtx = null;
let masterGain = null;
let coronaFilter = null;
let coronaGain = null;
let flybackOsc = null;
let flybackGain = null;

function initAudioGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    audioCtx = new AudioContextClass();

    // 2-second looping white noise buffer for high-voltage corona air ionization hiss
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    coronaFilter = audioCtx.createBiquadFilter();
    coronaFilter.type = 'bandpass';
    coronaFilter.frequency.value = 4200;
    coronaFilter.Q.value = 1.4;

    coronaGain = audioCtx.createGain();
    coronaGain.gain.value = 0.0;

    // Subtle flyback PWM transformer whine (scaled down to audible harmonic range ~3.2 kHz)
    flybackOsc = audioCtx.createOscillator();
    flybackOsc.type = 'triangle';
    flybackOsc.frequency.value = 3200;

    flybackGain = audioCtx.createGain();
    flybackGain.gain.value = 0.0;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;

    noiseSrc.connect(coronaFilter);
    coronaFilter.connect(coronaGain);
    coronaGain.connect(masterGain);

    flybackOsc.connect(flybackGain);
    flybackGain.connect(masterGain);

    masterGain.connect(audioCtx.destination);

    noiseSrc.start();
    flybackOsc.start();
    return true;
}

export function toggleAudio() {
    sim.audioEnabled = !sim.audioEnabled;
    if (sim.audioEnabled) {
        if (!audioCtx && !initAudioGraph()) {
            sim.audioEnabled = false;
            return false;
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } else if (audioCtx && coronaGain && flybackGain) {
        const now = audioCtx.currentTime;
        coronaGain.gain.setTargetAtTime(0.0, now, 0.05);
        flybackGain.gain.setTargetAtTime(0.0, now, 0.05);
    }
    return sim.audioEnabled;
}

export function updateCoronaAudio() {
    if (!sim.audioEnabled || !audioCtx || !coronaGain || !flybackGain) return;

    const now = audioCtx.currentTime;
    const maxKv = Math.max(sim.vSectorA, sim.vSectorB, sim.vSectorC);
    const denom = Math.max(1.0, sim.vMaxKv - sim.vOnsetKv);
    const intensity = maxKv > sim.vOnsetKv
        ? Math.min(1.0, (maxKv - sim.vOnsetKv) / denom)
        : 0.0;

    const diffKv = Math.max(sim.vSectorA, sim.vSectorB, sim.vSectorC) -
        Math.min(sim.vSectorA, sim.vSectorB, sim.vSectorC);

    const hissLevel = intensity * 0.28 + Math.min(0.14, diffKv * 0.025);
    const humLevel = (sim.vCommandKv / sim.vMaxKv) * 0.045;

    coronaFilter.frequency.setTargetAtTime(2400 + intensity * 4600, now, 0.06);
    coronaGain.gain.setTargetAtTime(hissLevel, now, 0.05);
    flybackOsc.frequency.setTargetAtTime(2900 + (sim.vCommandKv / sim.vMaxKv) * 900, now, 0.06);
    flybackGain.gain.setTargetAtTime(humLevel, now, 0.05);
}
