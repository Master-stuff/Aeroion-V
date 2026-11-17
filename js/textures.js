// ============================================================================
// PROCEDURAL PBR TEXTURES, STUDIO ENVIRONMENT & MATERIALS
// ============================================================================

export function createStudioEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x070d1c);

    const top = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, side: THREE.DoubleSide })
    );
    top.position.set(0, 12, 0);
    top.rotation.x = Math.PI / 2;
    s.add(top);

    const side1 = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 9),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    side1.position.set(-11, 5, 7);
    side1.lookAt(0, 0, 0);
    s.add(side1);

    const side2 = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 9),
        new THREE.MeshBasicMaterial({ color: 0xc084fc, side: THREE.DoubleSide })
    );
    side2.position.set(11, 5, -7);
    side2.lookAt(0, 0, 0);
    s.add(side2);

    const env = pmrem.fromScene(s, 0.04).texture;
    pmrem.dispose();
    return env;
}

export function createBenchGridTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let i = 0; i <= 1024; i += step) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
    }
    for (let x = step / 2; x < 1024; x += step) {
        for (let y = step / 2; y < 1024; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = '#020617';
            ctx.fill();
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
}

export function createRulerScaleTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 1024);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 124, 1020);

    // Graduations from 0 cm (bottom) to 40 cm (top)
    for (let cm = 0; cm <= 40; cm++) {
        const y = 980 - (cm / 40) * 920;
        const isMajor = (cm % 5 === 0);
        ctx.strokeStyle = isMajor ? '#38bdf8' : '#64748b';
        ctx.lineWidth = isMajor ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(isMajor ? 55 : 85, y);
        ctx.lineTo(124, y);
        ctx.stroke();

        if (isMajor) {
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 22px "JetBrains Mono", monospace';
            ctx.fillText(`${cm}`, 12, y + 7);
        }
    }
    return new THREE.CanvasTexture(c);
}

export function createBalsaWoodTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8cda2';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#c89d66';
    for (let i = 0; i < 500; i++) {
        ctx.globalAlpha = 0.22;
        ctx.fillRect(Math.random() * 256, 0, 1.5, 256);
    }
    return new THREE.CanvasTexture(c);
}

export function createColorTHTLabelTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 240);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.fillText('DANGER HIGH VOLTAGE', 32, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.fillText('THT TV COULEUR 29"', 32, 105);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.fillText('OUTPUT: 24.0 - 28.0 kV DC', 32, 155);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px sans-serif';
    ctx.fillText('DIODE SPLIT • FOCUS / SCREEN', 32, 205);
    return new THREE.CanvasTexture(c);
}

export function createParticleTexture() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');
    const pGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    pGrad.addColorStop(0, 'rgba(255,255,255,1)');
    pGrad.addColorStop(0.4, 'rgba(192,132,252,0.85)');
    pGrad.addColorStop(1, 'rgba(56,189,248,0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(pCanvas);
}

export function createMaterials() {
    return {
        aluMirror: new THREE.MeshStandardMaterial({
            color: 0xe2e8f0, metalness: 0.96, roughness: 0.08, side: THREE.DoubleSide
        }),
        aluBrushed: new THREE.MeshStandardMaterial({
            color: 0xcbd5e1, metalness: 0.85, roughness: 0.24
        }),
        copper: new THREE.MeshStandardMaterial({
            color: 0xea580c, metalness: 0.92, roughness: 0.18
        }),
        balsa: new THREE.MeshStandardMaterial({
            map: createBalsaWoodTexture(), roughness: 0.72, metalness: 0.02
        }),
        acrylic: new THREE.MeshPhysicalMaterial({
            color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.05, transmission: 0.55
        }),
        plaBlack: new THREE.MeshStandardMaterial({
            color: 0x18181b, roughness: 0.4, metalness: 0.15
        }),
        ferrite: new THREE.MeshStandardMaterial({
            color: 0x3f3f46, roughness: 0.55, metalness: 0.28
        }),
        hvRed: new THREE.MeshStandardMaterial({
            color: 0xdc2626, roughness: 0.28, metalness: 0.1
        }),
        resistorOrange: new THREE.MeshStandardMaterial({
            color: 0xf59e0b, roughness: 0.35, metalness: 0.1
        }),
        pcbBlue: new THREE.MeshStandardMaterial({
            color: 0x0284c7, roughness: 0.3, metalness: 0.25
        }),
        pcbDark: new THREE.MeshStandardMaterial({
            color: 0x0f172a, roughness: 0.32, metalness: 0.3
        })
    };
}
