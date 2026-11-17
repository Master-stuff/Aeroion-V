// ============================================================================
// REAL-TIME MULTI-TRACE PID OSCILLOSCOPE 2D CANVAS RENDERER
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

    // Background Grid & Axis Scale Labels
    oscCtx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    oscCtx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        const y = (h * i) / 4;
        oscCtx.beginPath();
        oscCtx.moveTo(0, y);
        oscCtx.lineTo(w, y);
        oscCtx.stroke();
    }

    oscCtx.font = '600 9px "JetBrains Mono", monospace';
    oscCtx.textBaseline = 'top';
    oscCtx.textAlign = 'left';
    oscCtx.fillStyle = 'rgba(16, 185, 129, 0.72)';
    oscCtx.fillText('40cm', 4, 3);
    oscCtx.fillText('20cm', 4, h * 0.5 - 5);
    oscCtx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    oscCtx.fillText('0', 4, h - 12);

    oscCtx.textAlign = 'right';
    oscCtx.fillStyle = 'rgba(56, 189, 248, 0.75)';
    oscCtx.fillText('30kV', w - 4, 3);
    oscCtx.fillText('15kV', w - 4, h * 0.5 - 5);

    const n = sim.histZAct.length;
    const padY = 8;
    const plotH = h - padY * 2;

    // 1. Target Altitude Z_ref (Dashed Amber Line, 0 to 40 cm scale)
    oscCtx.strokeStyle = '#fbbf24';
    oscCtx.lineWidth = 1.6;
    oscCtx.setLineDash([4, 4]);
    oscCtx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h - padY - (sim.histZRef[i] / 40.0) * plotH;
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
        const y = h - padY - (sim.histKv[i] / 30.0) * plotH;
        if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();

    // 3. Attitude Tilt Magnitude |θ| (Subtle Purple Line, 0 to 20 deg scale)
    oscCtx.strokeStyle = 'rgba(192, 132, 252, 0.72)';
    oscCtx.lineWidth = 1.4;
    oscCtx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const clampedTilt = Math.min(20.0, sim.histTilt[i] || 0);
        const y = h - padY - (clampedTilt / 20.0) * plotH;
        if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();

    // 4. Actual Measured Altitude Z(t) from HC-SR04 (Solid Emerald Line)
    oscCtx.strokeStyle = '#10b981';
    oscCtx.lineWidth = 2.4;
    oscCtx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h - padY - (sim.histZAct[i] / 40.0) * plotH;
        if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y);
    }
    oscCtx.stroke();

    // 5. Hover Crosshair & Sample Readout
    const idx = sim.oscHoverIndex;
    if (idx >= 0 && idx < n) {
        const x = (idx / (n - 1)) * w;
        const yAct = h - padY - (sim.histZAct[idx] / 40.0) * plotH;
        const yKv = h - padY - (sim.histKv[idx] / 30.0) * plotH;

        oscCtx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
        oscCtx.lineWidth = 1;
        oscCtx.setLineDash([2, 2]);
        oscCtx.beginPath();
        oscCtx.moveTo(x, 0);
        oscCtx.lineTo(x, h);
        oscCtx.stroke();
        oscCtx.setLineDash([]);

        oscCtx.fillStyle = '#10b981';
        oscCtx.beginPath();
        oscCtx.arc(x, yAct, 3.2, 0, Math.PI * 2);
        oscCtx.fill();

        oscCtx.fillStyle = '#38bdf8';
        oscCtx.beginPath();
        oscCtx.arc(x, yKv, 2.8, 0, Math.PI * 2);
        oscCtx.fill();

        const zVal = sim.histZAct[idx].toFixed(1);
        const refVal = sim.histZRef[idx].toFixed(1);
        const kvVal = sim.histKv[idx].toFixed(1);
        const tiltVal = (sim.histTilt[idx] || 0).toFixed(1);
        const label = `Z:${zVal} Ref:${refVal}cm | ${kvVal}kV | θ:${tiltVal}°`;

        oscCtx.font = '600 9.5px "JetBrains Mono", monospace';
        const boxW = Math.min(w - 12, oscCtx.measureText(label).width + 12);
        const boxX = Math.max(6, Math.min(w - boxW - 6, x > w * 0.55 ? x - boxW - 8 : x + 8));

        oscCtx.fillStyle = 'rgba(2, 6, 23, 0.9)';
        oscCtx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        oscCtx.lineWidth = 1;
        oscCtx.fillRect(boxX, 4, boxW, 17);
        oscCtx.strokeRect(boxX, 4, boxW, 17);

        oscCtx.fillStyle = '#e2e8f0';
        oscCtx.textAlign = 'left';
        oscCtx.textBaseline = 'middle';
        oscCtx.fillText(label, boxX + 6, 12.5);
    } else if (sim.oscPaused) {
        oscCtx.fillStyle = 'rgba(245, 158, 11, 0.9)';
        oscCtx.font = '700 9.5px "JetBrains Mono", monospace';
        oscCtx.textAlign = 'center';
        oscCtx.textBaseline = 'top';
        oscCtx.fillText('PAUSE', w * 0.5, 4);
    }
}

export function bindOscilloscopeInteractions() {
    if (!ensureContext()) return;

    const updateHover = (clientX) => {
        const rect = oscCanvas.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        sim.oscHoverIndex = Math.round(ratio * (sim.histZAct.length - 1));
        drawOscilloscope();
    };

    oscCanvas.addEventListener('pointermove', (e) => updateHover(e.clientX));
    oscCanvas.addEventListener('pointerdown', (e) => updateHover(e.clientX));
    oscCanvas.addEventListener('pointerleave', () => {
        sim.oscHoverIndex = -1;
        drawOscilloscope();
    });

    const pauseBtn = document.getElementById('btn-osc-pause');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            sim.oscPaused = !sim.oscPaused;
            if (sim.oscPaused) {
                pauseBtn.className = 'px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[9px] font-mono-tech font-bold transition';
                pauseBtn.innerHTML = '<i class="fas fa-play mr-1"></i>Reprendre';
            } else {
                pauseBtn.className = 'px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[9px] font-mono-tech font-semibold transition';
                pauseBtn.innerHTML = '<i class="fas fa-pause mr-1"></i>Pause';
            }
            drawOscilloscope();
        });
    }
}
