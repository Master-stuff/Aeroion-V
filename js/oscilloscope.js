// ============================================================================
// REAL-TIME PID OSCILLOSCOPE 2D CANVAS RENDERER
// ============================================================================

import { sim } from './state.js';

let oscCanvas = null;
let oscCtx = null;

function ensureContext() {
    if (!oscCanvas) {
        oscCanvas = document.getElementById('canvas-oscilloscope');
        if (oscCanvas) {
            oscCtx = oscCanvas.getContext('2d');
        }
    }
    return oscCanvas && oscCtx;
}

export function drawOscilloscope() {
    if (!ensureContext()) return;

    const w = oscCanvas.width;
    const h = oscCanvas.height;
    oscCtx.clearRect(0, 0, w, h);

    // Background Grid
    oscCtx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    oscCtx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        const y = (h * i) / 4;
        oscCtx.beginPath();
        oscCtx.moveTo(0, y);
        oscCtx.lineTo(w, y);
        oscCtx.stroke();
    }

    const n = sim.histZAct.length;

    // 1. Target Altitude Z_ref (Dashed Amber Line, 0 to 40 cm scale)
    oscCtx.strokeStyle = '#fbbf24';
    oscCtx.lineWidth = 1.6;
    oscCtx.setLineDash([4, 4]);
    oscCtx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h - 8 - (sim.histZRef[i] / 40.0) * (h - 16);
        if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();
    oscCtx.setLineDash([]);

    // 2. High Voltage V_THT (Sky Blue Line, 0 to 30 kV scale)
    oscCtx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    oscCtx.lineWidth = 1.8;
    oscCtx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h - 8 - (sim.histKv[i] / 30.0) * (h - 16);
        if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();

    // 3. Actual Measured Altitude Z(t) from HC-SR04 (Solid Emerald Line)
    oscCtx.strokeStyle = '#10b981';
    oscCtx.lineWidth = 2.4;
    oscCtx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h - 8 - (sim.histZAct[i] / 40.0) * (h - 16);
        if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();
}
