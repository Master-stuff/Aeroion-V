// ============================================================================
// UI / DOM CONTROLLER, TELEMETRY DISPLAY, 3D LABELS & EVENT BINDING
// ============================================================================

import { SUBSYSTEM_DB, LABEL_DEFS, CAMERA_VIEWS } from './config.js';
import {
    sim,
    applyTargetAltitudeState,
    applyPushPerturbationState,
    applyTiltPerturbationState,
    resetPIDGainsState,
    pushOscilloscopeSample
} from './state.js';
import { computeTelemetryMetrics } from './physics.js';
import { drawOscilloscope, bindOscilloscopeInteractions } from './oscilloscope.js';
import { toggleAudio } from './audio.js';
import {
    animateCam,
    focusSubsystemCamera,
    applyExplodedView,
    setSonarVisibility,
    projectWorldToScreen
} from './scene3d.js';

const labelEls = [];
let cachedBlockedRects = [];
let layoutDirty = true;
let rectCacheFrame = 0;

export function markLayoutDirty() {
    layoutDirty = true;
}

function showPushBanner() {
    const banner = document.getElementById('perturbation-banner');
    document.getElementById('perturbation-title').textContent = 'TEST DU JURY : POUSSÉE VERS LE BAS AVEC BAGUETTE (-10 CM)';
    document.getElementById('perturbation-sub').textContent = "Le capteur HC-SR04 détecte la baisse d'altitude → L'ESP32 pousse le gros THT à 27,8 kV pour remonter !";
    banner.classList.remove('hidden');
    markLayoutDirty();
}

function showTiltBanner() {
    const banner = document.getElementById('perturbation-banner');
    document.getElementById('perturbation-title').textContent = 'RAFALE LATÉRALE (+12° TILT) — STABILISATION 3 SECTEURS ACTIVE';
    document.getElementById('perturbation-sub').textContent = 'Survoltage automatique des secteurs bas (jusqu\'à 28,0 kV) pour redresser la fusée sans ailerons.';
    banner.classList.remove('hidden');
    markLayoutDirty();
}

export function hidePerturbationBanner() {
    if (sim.pushTimer <= 0 && sim.windTimer <= 0) {
        document.getElementById('perturbation-banner').classList.add('hidden');
        markLayoutDirty();
    }
}

export function updateTelemetryAndOscilloscope() {
    const { errCm, echoUs, pwmPct, twRatio, sectorDeltaKv, totalTiltDeg, isLocked } = computeTelemetryMetrics();

    document.getElementById('kpi-altitude').textContent = `${sim.zActualCm.toFixed(1)} cm`;
    document.getElementById('kpi-alt-error').textContent = `(Err: ${errCm >= 0 ? '+' : ''}${errCm.toFixed(1)}cm)`;
    document.getElementById('kpi-echo-us').textContent = `${echoUs} µs`;

    document.getElementById('kpi-voltage').textContent = `${sim.vCommandKv.toFixed(1)} kV`;
    document.getElementById('kpi-pwm').textContent = `PWM: ${pwmPct}%`;
    document.getElementById('kpi-current').textContent = `${sim.currentMa.toFixed(2)} mA`;

    document.getElementById('kpi-thrust-mn').textContent = `${sim.thrustMn.toFixed(1)} mN`;
    document.getElementById('kpi-thrust-gf').textContent = `(${sim.thrustGf.toFixed(2)} gf)`;
    document.getElementById('kpi-tw-ratio').textContent = `Masse Fusée : ${sim.rocketMassG.toFixed(2)} g (T/W = ${twRatio})`;

    document.getElementById('kpi-tilt-angle').textContent = `${totalTiltDeg.toFixed(1)}°`;
    document.getElementById('kpi-sector-state').textContent = !sim.sectorStabEnabled
        ? 'Stab. 3 Secteurs COUPÉE'
        : sectorDeltaKv > 0.3
            ? `Correction Active (ΔV=${sectorDeltaKv.toFixed(1)} kV)`
            : '3 Secteurs Équilibrés';

    // 3-Sector voltage bars
    document.getElementById('val-kv-a').textContent = `${sim.vSectorA.toFixed(1)} kV`;
    document.getElementById('val-kv-b').textContent = `${sim.vSectorB.toFixed(1)} kV`;
    document.getElementById('val-kv-c').textContent = `${sim.vSectorC.toFixed(1)} kV`;
    document.getElementById('bar-kv-a').style.width = `${(sim.vSectorA / 28.0) * 100}%`;
    document.getElementById('bar-kv-b').style.width = `${(sim.vSectorB / 28.0) * 100}%`;
    document.getElementById('bar-kv-c').style.width = `${(sim.vSectorC / 28.0) * 100}%`;

    // Flight Mode Status Badge
    const badge = document.getElementById('badge-flight-mode');
    if (isLocked) {
        badge.textContent = `VERROUILLÉ À ${sim.zActualCm.toFixed(1)} CM`;
        badge.className = 'text-[10px] font-mono-tech px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold';
    } else {
        badge.textContent = 'CORRECTION PID EN COURS';
        badge.className = 'text-[10px] font-mono-tech px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-400/50 font-bold animate-pulse';
    }

    pushOscilloscopeSample();
    drawOscilloscope();
}

export function syncPhysicsUIEvents(events) {
    if (sim.pidEnabled) {
        document.getElementById('slider-manual-kv').value = sim.vCommandKv.toFixed(1);
        document.getElementById('val-manual-kv').textContent = `${sim.vCommandKv.toFixed(1)} kV`;
    }

    if (events.zRefChanged) {
        document.getElementById('slider-zref').value = sim.zRefCm;
        document.getElementById('val-zref').textContent = `${sim.zRefCm.toFixed(1)} cm`;
    }

    if (events.perturbationTriggered === 'push') {
        showPushBanner();
    } else if (events.perturbationTriggered === 'tilt') {
        showTiltBanner();
    }

    if (events.checkHideBanner) {
        hidePerturbationBanner();
    }
}

export function setTargetAltitude(cm, fromAuto = false) {
    if (!fromAuto && sim.autoDemo) toggleAutoDemo();
    applyTargetAltitudeState(cm);
    document.getElementById('slider-zref').value = cm;
    document.getElementById('val-zref').textContent = `${cm.toFixed(1)} cm`;
}

function onSetpointChange() {
    if (sim.autoDemo) toggleAutoDemo();
    applyTargetAltitudeState(parseFloat(document.getElementById('slider-zref').value));
    document.getElementById('val-zref').textContent = `${sim.zRefCm.toFixed(1)} cm`;
}

function togglePIDLoop() {
    sim.pidEnabled = !sim.pidEnabled;
    const btn = document.getElementById('btn-pid-toggle');
    const knob = document.getElementById('knob-pid-toggle');
    const manBox = document.getElementById('manual-voltage-box');

    if (sim.pidEnabled) {
        btn.className = 'w-11 h-6 rounded-full bg-emerald-500 p-0.5 transition-colors relative flex items-center';
        knob.className = 'w-5 h-5 rounded-full bg-white shadow-md transform translate-x-5 transition-transform';
        manBox.className = 'opacity-50 pointer-events-none transition-opacity pt-1 border-t border-slate-800/80';
    } else {
        btn.className = 'w-11 h-6 rounded-full bg-slate-700 p-0.5 transition-colors relative flex items-center';
        knob.className = 'w-5 h-5 rounded-full bg-slate-300 shadow-md transform translate-x-0 transition-transform';
        manBox.className = 'opacity-100 pointer-events-auto transition-opacity pt-1 border-t border-slate-800/80';
    }
}

function onManualKvChange() {
    if (!sim.pidEnabled) {
        sim.vCommandKv = parseFloat(document.getElementById('slider-manual-kv').value);
        document.getElementById('val-manual-kv').textContent = `${sim.vCommandKv.toFixed(1)} kV`;
    }
}

function syncPIDAndPhysicsSlidersUI() {
    document.getElementById('slider-kp').value = sim.kp;
    document.getElementById('val-kp').textContent = sim.kp.toFixed(2);
    document.getElementById('slider-ki').value = sim.ki;
    document.getElementById('val-ki').textContent = sim.ki.toFixed(2);
    document.getElementById('slider-kd').value = sim.kd;
    document.getElementById('val-kd').textContent = sim.kd.toFixed(2);
    document.getElementById('slider-mass').value = sim.rocketMassG;
    document.getElementById('val-mass').textContent = `${sim.rocketMassG.toFixed(2)} g`;
    document.getElementById('slider-gap').value = sim.gapMm;
    document.getElementById('val-gap').textContent = `${sim.gapMm.toFixed(0)} mm`;
}

function toggleSectorStabilization() {
    sim.sectorStabEnabled = !sim.sectorStabEnabled;
    const btn = document.getElementById('btn-sector-toggle');
    const knob = document.getElementById('knob-sector-toggle');
    if (sim.sectorStabEnabled) {
        btn.className = 'w-11 h-6 rounded-full bg-purple-600 p-0.5 transition-colors relative flex items-center';
        knob.className = 'w-5 h-5 rounded-full bg-white shadow-md transform translate-x-5 transition-transform';
    } else {
        btn.className = 'w-11 h-6 rounded-full bg-slate-700 p-0.5 transition-colors relative flex items-center';
        knob.className = 'w-5 h-5 rounded-full bg-slate-300 shadow-md transform translate-x-0 transition-transform';
    }
}

function onManualTiltChange() {
    sim.manualTiltBiasDeg = parseFloat(document.getElementById('slider-manual-tilt').value);
    document.getElementById('val-manual-tilt').textContent = `${sim.manualTiltBiasDeg > 0 ? '+' : ''}${sim.manualTiltBiasDeg.toFixed(1)}°`;
}

export function triggerPushPerturbation() {
    const { zRefUpdated } = applyPushPerturbationState();
    if (zRefUpdated) {
        document.getElementById('slider-zref').value = sim.zRefCm;
        document.getElementById('val-zref').textContent = `${sim.zRefCm.toFixed(1)} cm`;
    }
    showPushBanner();
}

export function triggerTiltPerturbation() {
    applyTiltPerturbationState();
    showTiltBanner();
}

export function toggleAutoDemo() {
    sim.autoDemo = !sim.autoDemo;
    sim.autoDemoTimer = 0.0;
    const btn = document.getElementById('btn-auto-demo');
    const mobileBtn = document.querySelector('#responsive-toolbar [data-action="demo"]');

    if (sim.autoDemo) {
        if (!sim.pidEnabled) togglePIDLoop();
        if (!sim.sectorStabEnabled) toggleSectorStabilization();
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-500 text-slate-950 border border-emerald-300 transition shadow-lg shadow-emerald-500/30';
        btn.innerHTML = '<i class="fas fa-stop"></i><span>Arrêter Démo</span>';
        if (mobileBtn) {
            mobileBtn.classList.add('active');
            mobileBtn.textContent = '■ Stop';
        }
    } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/50 transition';
        btn.innerHTML = '<i class="fas fa-play"></i><span>Démo Automatique</span>';
        if (mobileBtn) {
            mobileBtn.classList.remove('active');
            mobileBtn.textContent = '▶ Démo';
        }
    }
}

function handleAudioToggle() {
    const active = toggleAudio();
    const btn = document.getElementById('btn-audio-toggle');
    const mobileBtn = document.querySelector('#responsive-toolbar [data-action="audio"]');

    if (btn) {
        btn.className = active
            ? 'px-2.5 py-1 rounded-lg bg-cyan-500/25 border border-cyan-400/60 text-cyan-200 text-xs font-semibold transition flex items-center gap-1'
            : 'px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-600/50 text-xs font-semibold transition flex items-center gap-1';
        btn.innerHTML = active
            ? '<i class="fas fa-volume-high text-cyan-300"></i><span>Son</span>'
            : '<i class="fas fa-volume-xmark text-slate-400"></i><span>Son</span>';
    }
    if (mobileBtn) {
        mobileBtn.classList.toggle('active', active);
        mobileBtn.textContent = active ? '🔊 Son' : '🔇 Son';
    }
}

function updateExplodedView() {
    const val = parseFloat(document.getElementById('slider-exploded').value);
    sim.explodedFactor = val / 100.0;
    document.getElementById('val-exploded').textContent = `${val} %`;
    applyExplodedView(sim.explodedFactor);
}

function toggleSonarWaves() {
    sim.showSonar = !sim.showSonar;
    setSonarVisibility(sim.showSonar);
    const btn = document.getElementById('btn-sonar-waves');
    btn.className = sim.showSonar
        ? 'px-2 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition'
        : 'px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition';
}

function toggle3DLabels() {
    sim.showLabels = !sim.showLabels;
    const btn = document.getElementById('btn-3d-labels');
    btn.className = sim.showLabels
        ? 'px-2 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition'
        : 'px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition';
}

export function setCamView(view) {
    if (view === 'overview') animateCam(CAMERA_VIEWS.overview.pos, CAMERA_VIEWS.overview.target);
    if (view === 'rocket') selectSubsystem('sectors');
    if (view === 'sensor') selectSubsystem('hcsr04');
    if (view === 'tht') selectSubsystem('tht28');
}

export function selectSubsystem(subKey) {
    const info = SUBSYSTEM_DB[subKey];
    if (!info) return;
    sim.activeSubsystemKey = subKey;

    document.getElementById('insp-category').textContent = info.category;
    document.getElementById('insp-title').textContent = info.title;
    document.getElementById('insp-tag').textContent = info.tag;
    document.getElementById('insp-spec').textContent = info.spec;
    document.getElementById('insp-benefit').textContent = info.benefit;
    document.getElementById('insp-desc').textContent = info.desc;

    document.querySelectorAll('.sub-chip').forEach(btn => {
        btn.className = 'sub-chip px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700 shrink-0 transition';
    });
    const activeBtn = document.getElementById(`chip-${subKey}`);
    if (activeBtn) {
        activeBtn.className = 'sub-chip px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/25 text-sky-200 border border-sky-400/50 shrink-0 transition';
    }

    focusSubsystemCamera(subKey);
}

function refreshBlockedRectsCache() {
    const blockedSelectors = [
        'header', '#controls-panel', '#telemetry-panel',
        'footer', '#responsive-toolbar', '#perturbation-banner'
    ];
    cachedBlockedRects = blockedSelectors
        .map(selector => document.querySelector(selector))
        .filter(element => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 1 && rect.height > 1);

    labelEls.forEach(entry => {
        entry.w = 0;
        entry.h = 0;
    });
    layoutDirty = false;
}

export function update3DLabels() {
    if (!sim.showLabels) {
        labelEls.forEach(({ el }) => { el.style.display = 'none'; });
        return;
    }

    rectCacheFrame++;
    if (layoutDirty || rectCacheFrame % 15 === 0) {
        refreshBlockedRectsCache();
    }

    const compactScreen = window.innerWidth <= 900;
    const overlaps = (a, b) =>
        a.left < b.right && a.right > b.left &&
        a.top < b.bottom && a.bottom > b.top;

    const visibleLabelRects = [];
    const orderedLabels = [...labelEls].sort((a, b) =>
        Number(b.d.key === sim.activeSubsystemKey) - Number(a.d.key === sim.activeSubsystemKey)
    );

    orderedLabels.forEach((entry) => {
        const { el, d } = entry;
        if (compactScreen && d.key !== sim.activeSubsystemKey) {
            el.style.display = 'none';
            return;
        }

        const projected = projectWorldToScreen(d.offset, d.followRocket);
        if (!projected) {
            el.style.display = 'none';
            return;
        }

        el.style.display = 'flex';
        el.style.left = `${projected.x}px`;
        el.style.top = `${projected.y}px`;

        if (!entry.w || !entry.h) {
            entry.w = el.offsetWidth;
            entry.h = el.offsetHeight;
        }
        const halfW = entry.w * 0.5;
        const halfH = entry.h * 0.5;
        const rect = {
            left: projected.x - halfW,
            right: projected.x + halfW,
            top: projected.y - halfH,
            bottom: projected.y + halfH
        };

        const margin = compactScreen ? 8 : 10;
        const outsideViewport = rect.left < margin || rect.right > window.innerWidth - margin ||
            rect.top < margin || rect.bottom > window.innerHeight - margin;
        const coveredByUI = cachedBlockedRects.some(blocked => overlaps(rect, blocked));
        const coveredByAnotherLabel = visibleLabelRects.some(other => overlaps(rect, other));

        if (outsideViewport || coveredByUI || coveredByAnotherLabel) {
            el.style.display = 'none';
        } else {
            visibleLabelRects.push(rect);
        }
    });
}

function syncDesktopPanelLayout() {
    if (window.innerWidth <= 900) return;
    const header = document.querySelector('header');
    if (!header) return;
    const headerBottom = header.getBoundingClientRect().bottom;
    const top = Math.max(88, Math.ceil(headerBottom + 10));
    const maxHeight = Math.max(170, window.innerHeight - top - 82);
    document.documentElement.style.setProperty('--desktop-panel-top', `${top}px`);
    document.documentElement.style.setProperty('--desktop-panel-max-height', `${maxHeight}px`);
    markLayoutDirty();
}

function toggleDesktopFocus() {
    const enabled = document.body.classList.toggle('focus-mode');
    const button = document.getElementById('desktop-focus-toggle');
    if (button) {
        button.setAttribute('aria-pressed', String(enabled));
        button.innerHTML = enabled
            ? '<i class="fas fa-compress"></i><span>Afficher panneaux</span>'
            : '<i class="fas fa-expand"></i><span>Vue 3D</span>';
        button.title = enabled
            ? 'Réafficher les panneaux de commande et de télémétrie'
            : 'Masquer les panneaux pour dégager le modèle 3D';
    }
    syncDesktopPanelLayout();
    markLayoutDirty();
}

function setupResponsiveToolbar() {
    const toolbar = document.getElementById('responsive-toolbar');
    const panels = [document.getElementById('controls-panel'), document.getElementById('telemetry-panel')];
    if (!toolbar) return;

    function closeMobilePanels() {
        panels.forEach(panel => panel.classList.remove('mobile-panel-open'));
        toolbar.querySelectorAll('[data-panel]').forEach(button => button.classList.remove('active'));
        markLayoutDirty();
    }

    toolbar.querySelectorAll('[data-panel]').forEach(button => {
        button.addEventListener('click', () => {
            const panel = document.getElementById(button.dataset.panel);
            const wasOpen = panel && panel.classList.contains('mobile-panel-open');
            closeMobilePanels();
            if (panel && !wasOpen) {
                panel.classList.add('mobile-panel-open');
                button.classList.add('active');
            }
            markLayoutDirty();
        });
    });

    toolbar.querySelectorAll('[data-camera]').forEach(button => {
        button.addEventListener('click', () => {
            setCamView(button.dataset.camera);
        });
    });

    toolbar.querySelector('[data-action="push"]')?.addEventListener('click', triggerPushPerturbation);
    toolbar.querySelector('[data-action="tilt"]')?.addEventListener('click', triggerTiltPerturbation);
    toolbar.querySelector('[data-action="demo"]')?.addEventListener('click', toggleAutoDemo);
    toolbar.querySelector('[data-action="audio"]')?.addEventListener('click', handleAudioToggle);

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeMobilePanels();
        markLayoutDirty();
    });
}

function build3DLabels() {
    const labelsContainer = document.getElementById('labels-container');
    LABEL_DEFS.forEach(d => {
        const el = document.createElement('div');
        el.className = 'label-3d px-2.5 py-1 rounded-full text-[11px] font-semibold glass-panel text-sky-200 border border-sky-400/40 flex items-center gap-1.5 shadow-lg';
        const dot = document.createElement('span');
        dot.className = 'w-2 h-2 rounded-full bg-sky-400 flex-shrink-0';
        dot.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.textContent = d.text;
        el.append(dot, text);
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `Inspecter : ${d.text}`);
        el.title = d.text;
        el.addEventListener('click', () => selectSubsystem(d.key));
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectSubsystem(d.key);
            }
        });
        labelsContainer.appendChild(el);
        labelEls.push({ el, d, w: 0, h: 0 });
    });
}

function bindUIControls() {
    document.getElementById('desktop-focus-toggle')?.addEventListener('click', toggleDesktopFocus);
    document.getElementById('btn-test-push')?.addEventListener('click', triggerPushPerturbation);
    document.getElementById('btn-test-tilt')?.addEventListener('click', triggerTiltPerturbation);
    document.getElementById('btn-auto-demo')?.addEventListener('click', toggleAutoDemo);
    document.getElementById('btn-audio-toggle')?.addEventListener('click', handleAudioToggle);

    document.querySelectorAll('[data-cam-preset]').forEach(btn => {
        btn.addEventListener('click', () => setCamView(btn.dataset.camPreset));
    });

    document.getElementById('slider-zref')?.addEventListener('input', onSetpointChange);
    document.querySelectorAll('[data-altitude-target]').forEach(btn => {
        btn.addEventListener('click', () => setTargetAltitude(parseFloat(btn.dataset.altitudeTarget)));
    });

    document.getElementById('btn-pid-toggle')?.addEventListener('click', togglePIDLoop);
    document.getElementById('slider-manual-kv')?.addEventListener('input', onManualKvChange);

    // Interactive PID Gain & Physical Parameter Sliders
    document.getElementById('slider-kp')?.addEventListener('input', (e) => {
        sim.kp = parseFloat(e.target.value);
        document.getElementById('val-kp').textContent = sim.kp.toFixed(2);
    });
    document.getElementById('slider-ki')?.addEventListener('input', (e) => {
        sim.ki = parseFloat(e.target.value);
        document.getElementById('val-ki').textContent = sim.ki.toFixed(2);
    });
    document.getElementById('slider-kd')?.addEventListener('input', (e) => {
        sim.kd = parseFloat(e.target.value);
        document.getElementById('val-kd').textContent = sim.kd.toFixed(2);
    });
    document.getElementById('slider-mass')?.addEventListener('input', (e) => {
        sim.rocketMassG = parseFloat(e.target.value);
        document.getElementById('val-mass').textContent = `${sim.rocketMassG.toFixed(2)} g`;
    });
    document.getElementById('slider-gap')?.addEventListener('input', (e) => {
        sim.gapMm = parseFloat(e.target.value);
        document.getElementById('val-gap').textContent = `${sim.gapMm.toFixed(0)} mm`;
    });
    document.getElementById('btn-pid-reset')?.addEventListener('click', () => {
        resetPIDGainsState();
        syncPIDAndPhysicsSlidersUI();
    });

    document.getElementById('btn-sector-toggle')?.addEventListener('click', toggleSectorStabilization);
    document.getElementById('slider-manual-tilt')?.addEventListener('input', onManualTiltChange);

    document.getElementById('slider-exploded')?.addEventListener('input', updateExplodedView);
    document.getElementById('btn-sonar-waves')?.addEventListener('click', toggleSonarWaves);
    document.getElementById('btn-3d-labels')?.addEventListener('click', toggle3DLabels);

    document.querySelectorAll('[data-subsystem]').forEach(btn => {
        btn.addEventListener('click', () => selectSubsystem(btn.dataset.subsystem));
    });
}

export function initUI() {
    build3DLabels();
    bindUIControls();
    bindOscilloscopeInteractions();
    syncPIDAndPhysicsSlidersUI();
    setupResponsiveToolbar();

    window.addEventListener('resize', syncDesktopPanelLayout, { passive: true });
    if (window.ResizeObserver) {
        const headerObserver = new ResizeObserver(syncDesktopPanelLayout);
        const header = document.querySelector('header');
        if (header) headerObserver.observe(header);
    }
    requestAnimationFrame(syncDesktopPanelLayout);
}
