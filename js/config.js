// ============================================================================
// SUBSYSTEM TECHNICAL DATABASE, GEOMETRY CONSTANTS & LABEL DEFINITIONS
// ============================================================================

export const TOWER_X = -1.4;
export const PARTICLE_COUNT = 1350; // 450 particles per sector (A, B, C)
export const ARC_SPAN = (Math.PI * 2) / 3 - 0.18; // 120° minus 5mm insulating gap between sectors
export const TETHER_SEGMENTS = 24;

export const DEFAULT_PID = {
    kp: 0.65,
    ki: 0.35,
    kd: 0.32
};

export const DEFAULT_PHYSICS = {
    rocketMassG: 3.20,
    gapMm: 22.0
};

const SQRT3_2 = Math.sqrt(3) / 2;

// Sector A: Front-Left (150°), Sector B: Front-Right (30°), Sector C: Rear (270°)
// (ux, uz) are unit radial direction vectors in the horizontal XZ plane.
export const SECTOR_ANGLES = [
    { id: 'A', startAngle: Math.PI / 2 + 0.09, centerAngle: (5 * Math.PI) / 6, ux: -SQRT3_2, uz: 0.5 },
    { id: 'B', startAngle: -Math.PI / 6 + 0.09, centerAngle: Math.PI / 6, ux: SQRT3_2, uz: 0.5 },
    { id: 'C', startAngle: (7 * Math.PI) / 6 + 0.09, centerAngle: (3 * Math.PI) / 2, ux: 0.0, uz: -1.0 }
];

export const CAMERA_VIEWS = {
    overview: { pos: { x: 0.2, y: 3.8, z: 9.2 }, target: { x: -0.2, y: 2.0, z: 0 } }
};

export const SUBSYSTEM_DB = {
    rocket: {
        category: "Propulsion Électrohydrodynamique Multi-Étages",
        title: "Fusée EHD Bi-Étage « Turbo Ionique » Ultra-Légère (3,20 g)",
        tag: "Ratio T/W max = 2,15",
        spec: "Châssis Balsa 1.5mm + 2 Couronnes Corona",
        benefit: "Double la poussée à tension égale",
        desc: "Construite en fines baguettes de balsa (3,20 g au total) et guidée par deux fils de nylon tendus, la fusée superpose deux étages d'ionisation : l'étage supérieur aspire l'air ambiant et l'accélère vers le bas, puis l'étage inférieur reprend ce flux pour lui donner une seconde accélération électrique.",
        camPos: { x: -1.1, y: 3.3, z: 5.2 },
        lookAt: { x: -1.4, y: 2.1, z: 0 }
    },
    sectors: {
        category: "Guidage Vectoriel 100 % Électronique",
        title: "Stabilisation Active à 3 Secteurs d'Aluminium (A, B, C)",
        tag: "0 Aileron Mobile",
        spec: "3 Jupes NACA espacées de 5 mm (120°)",
        benefit: "Redresse l'inclinaison en < 5 ms",
        desc: "Au lieu d'une jupe d'aluminium continue, chaque étage est séparé en 3 secteurs indépendants (Secteur A Avant-Gauche, Secteur B Avant-Droite, Secteur C Arrière). Si la fusée penche, le répartiteur augmente la tension sur le secteur bas : le plasma y brille plus fort et redresse instantanément la fusée.",
        camPos: { x: -0.4, y: 2.7, z: 3.6 },
        lookAt: { x: -1.4, y: 2.0, z: 0 }
    },
    hcsr04: {
        category: "Capteur de Télémétrie & Boucle Fermée",
        title: "Sonar Ultrasonique d'Altitude HC-SR04 (Mesure Temps Réel)",
        tag: "Précision ±2 mm",
        spec: "Émission 40 kHz • Lecture 50 Hz vers ESP32",
        benefit: "Maintient l'altitude face aux perturbations",
        desc: "Fixé au centre de la base de lancement et orienté vers le haut, le capteur HC-SR04 envoie des impulsions ultrasonores à 40 kHz qui rebondissent sous la fusée. L'ESP32 mesure le temps d'écho pour calculer la hauteur Z exacte et ajuster la puissance du THT en boucle fermée (PID).",
        camPos: { x: -1.2, y: 1.2, z: 3.4 },
        lookAt: { x: -1.4, y: 0.45, z: 0 }
    },
    tht28: {
        category: "Source Haute Puissance Récupérée",
        title: "Gros Transformateur THT de Télévision Couleur (24–28 kV DC)",
        tag: "Sortie 28 kV DC",
        spec: "Molettes FOCUS/SCREEN + 5 Spires Ferrite",
        benefit: "3× plus de poussée sans multiplicateur externe",
        desc: "Extrait d'un téléviseur cathodique couleur (14\" à 29\"), ce gros transformateur THT intègre des diodes haute tension capables de délivrer jusqu'à 28 kV DC directement par son câble rouge. Il est piloté par 5 tours de fil bobinés sur son noyau en ferrite gris et hachés en PWM par le gros transistor sur radiateur.",
        camPos: { x: 3.1, y: 2.2, z: 3.7 },
        lookAt: { x: 2.1, y: 0.85, z: -0.4 }
    },
    ballast: {
        category: "Protection Physique & Anti-Arc",
        title: "Chaîne Ballast de 10 Résistances de 1 MΩ en Série (10 MΩ)",
        tag: "I_max < 2.8 mA",
        spec: "10 × 1 MΩ (1W) sous tube acrylique isolant",
        benefit: "Sécurité totale du jury + Zéro étincelle",
        desc: "Placée en série à la sortie du câble rouge 28 kV avant les fils d'alimentation de la fusée, cette chaîne de 10 résistances de 1 MΩ empêche le courant de dépasser 2,8 mA même en cas de court-circuit, stabilisant l'effet couronne violet sans claquage destructeur.",
        camPos: { x: 1.9, y: 1.8, z: 3.1 },
        lookAt: { x: 1.15, y: 0.85, z: 0.15 }
    },
    esp32: {
        category: "Intelligence Embarquée & Asservissement",
        title: "Contrôleur ESP32 PID + Répartiteur Haute Tension 3 Voies",
        tag: "Boucle PID 100 Hz",
        spec: "Algorithme PID + Modulation PWM 25 kHz",
        benefit: "Pilotage Wi-Fi en direct par le jury",
        desc: "L'ESP32 compare 100 fois par seconde l'altitude mesurée Z(t) par le capteur HC-SR04 avec la consigne d’altitude de référence choisie. Si un membre du jury appuie sur la fusée avec une baguette, l'ESP32 augmente immédiatement la tension jusqu'à 27,8 kV pour contrer la main et ramener la fusée à sa consigne.",
        camPos: { x: 2.8, y: 1.8, z: 4.1 },
        lookAt: { x: 2.0, y: 0.35, z: 1.55 }
    }
};

export const LABEL_DEFS = [
    { key: 'rocket', text: 'Étage 1 & 2 (Turbo Ionique 3.20g)', offset: { x: 0, y: 2.0, z: 0 }, followRocket: true },
    { key: 'sectors', text: '3 Secteurs Alu (A, B, C Sans Ailerons)', offset: { x: 0.85, y: 0.5, z: 0.4 }, followRocket: true },
    { key: 'hcsr04', text: 'Capteur Ultrason HC-SR04 (Altitude Z)', offset: { x: TOWER_X, y: 0.48, z: 0.5 }, followRocket: false },
    { key: 'tht28', text: 'Gros THT TV Couleur (28 kV DC)', offset: { x: 2.15, y: 2.05, z: -0.45 }, followRocket: false },
    { key: 'ballast', text: 'Chaîne Sécurité 10× 1 MΩ', offset: { x: 1.15, y: 1.25, z: 0.15 }, followRocket: false },
    { key: 'esp32', text: 'ESP32 PID + Répartiteur 3 Voies', offset: { x: 1.95, y: 0.55, z: 1.55 }, followRocket: false }
];
