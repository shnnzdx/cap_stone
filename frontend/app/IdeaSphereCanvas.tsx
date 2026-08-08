"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type IdeaSphereStoryMotion = {
  expansion: number;
  absorption: number;
  rotationDamp: number;
  shatter: number;
  mapProgress: number;
};

type IdeaParticle = {
  index: number;
  label: string;
  base: THREE.Vector3;
  phase: number;
  amp: number;
  freq: number;
  anchor: boolean;
};

const IDEA_LABELS = [
  "Budget ceiling",
  "Late checkout",
  "Quiet hotel",
  "Museum morning",
  "Vegetarian dinner",
  "Window seats",
  "No red-eye flight",
  "Walkable area",
  "Accessible transit",
  "Free afternoon",
  "Family room",
  "Early train",
  "Food market",
  "Pool access",
  "Short transfer",
  "Privacy note",
  "Flexible dates",
  "Local guide",
];

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aPhase;
  attribute float aAmp;
  attribute float aFreq;
  attribute float aBrightness;
  attribute vec3 aShatterVector;
  attribute float aShatterDelay;
  attribute float aShatterStrength;
  attribute float aShatterSeed;
  attribute vec3 aMapPosition;
  attribute float aMapDelay;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBrightness;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReduceMotion;
  uniform float uAbsorption;
  uniform float uShatter;
  uniform float uShatterScale;
  uniform float uMapProgress;

  void main() {
    vec3 displaced = position;
    float radius = length(position);
    float mapProgress = uMapProgress;
    float mapEaseGlobal = smoothstep(0.02, 0.94, mapProgress);
    float driftAmount = (1.0 - uReduceMotion) * mix(1.0, 0.14, mapEaseGlobal);
    float drift = sin(uTime * aFreq + aPhase) * aAmp * driftAmount;
    displaced += normalize(position + vec3(0.12, -0.08, 0.18)) * drift;
    displaced.x += cos(uTime * (aFreq * 0.73) + aPhase * 1.7) * aAmp * 0.38 * driftAmount;
    displaced.y += sin(uTime * (aFreq * 0.61) + aPhase * 0.9) * aAmp * 0.28 * driftAmount;

    float shatter = uShatter * (1.0 - uReduceMotion);
    float shellWeight = smoothstep(0.56, 1.08, radius);
    float instability = smoothstep(0.02, 0.28, shatter) * (1.0 - smoothstep(0.48, 0.9, shatter));
    float regional = sin(position.x * 4.1 + aShatterSeed * 6.2831) * cos(position.y * 3.3 - aShatterSeed * 3.6);
    float boundaryLift = regional * shellWeight * instability * 0.055;
    displaced += normalize(position + vec3(0.04, -0.02, 0.03)) * boundaryLift;
    displaced.x += regional * shellWeight * instability * 0.028;
    displaced.y += sin(position.z * 4.8 + aShatterSeed * 5.1) * shellWeight * instability * 0.018;

    float release = smoothstep(aShatterDelay, aShatterDelay + 0.28, shatter);
    float releaseEase = release * release * (3.0 - 2.0 * release);
    float localLoosen = smoothstep(aShatterDelay - 0.06, aShatterDelay + 0.1, shatter) * (1.0 - releaseEase);
    displaced += normalize(position + aShatterVector * 0.18) * localLoosen * shellWeight * 0.09;
    displaced += aShatterVector * releaseEase * aShatterStrength * uShatterScale;

    float mapLocal = smoothstep(aMapDelay, aMapDelay + 0.32, mapProgress);
    float mapEase = mapLocal * mapLocal * (3.0 - 2.0 * mapLocal);
    vec3 curve = vec3(
      sin(aShatterSeed * 6.2831) * 0.07,
      cos(aShatterSeed * 5.17) * 0.04,
      sin(aShatterSeed * 8.11) * 0.05
    ) * sin(mapEase * 3.14159) * (1.0 - mapEase * 0.18);
    displaced = mix(displaced, aMapPosition, mapEase) + curve;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float depthScale = clamp(2.32 / -mvPosition.z, 0.42, 2.05);
    gl_PointSize = aSize * uPixelRatio * depthScale * mix(1.0, 1.05, uAbsorption) * mix(1.0, 0.88, releaseEase) * mix(1.0, 1.02, mapEaseGlobal);

    vColor = color;
    vAlpha = aAlpha * mix(1.0, 1.14, uAbsorption) * mix(1.0, 0.92, releaseEase) * mix(1.0, 1.08, mapEaseGlobal);
    vBrightness = aBrightness * clamp(depthScale, 0.82, 1.24) * mix(1.0, 1.07, uAbsorption) * mix(1.0, 0.96, releaseEase) * mix(1.0, 1.04, mapEaseGlobal);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBrightness;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    float core = smoothstep(0.5, 0.08, d);
    float edge = smoothstep(0.5, 0.22, d);
    float alpha = core * vAlpha;
    vec3 color = vColor * vBrightness + edge * vec3(0.08, 0.13, 0.18);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pickCount(viewportWidth: number) {
  if (viewportWidth < 640) return { visual: 1200, interactive: 48 };
  if (viewportWidth < 980) return { visual: 3200, interactive: 92 };
  return { visual: 7600, interactive: 164 };
}

function sphericalPoint(rand: () => number) {
  const u = rand();
  const v = rand();
  const theta = Math.PI * 2 * u;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

function layerRadius(rand: () => number) {
  const layer = rand();
  if (layer < 0.57) return 0.82 + rand() * 0.25;
  if (layer < 0.89) return 0.58 + rand() * 0.35;
  return 0.32 + rand() * 0.34;
}

function projectedLabelPlacement(x: number, y: number, width: number, height: number) {
  const preferLeft = x > width * 0.56;
  const preferTop = y > height * 0.58;
  return {
    left: preferLeft ? x - 166 : x + 14,
    top: preferTop ? y - 50 : y + 14,
  };
}

type IdeaSphereCanvasProps = {
  storyMotionRef?: MutableRefObject<IdeaSphereStoryMotion>;
};

function shatterScaleForViewport(width: number) {
  if (width < 640) return 0.46;
  if (width < 980) return 0.62;
  return 0.78;
}

type MapCandidate = {
  x: number;
  y: number;
};

type MapTargetData = {
  positions: Float32Array;
  delays: Float32Array;
  candidateCount: number;
  source: "mask" | "fallback";
};

const WORLD_MAP_MASK_SRC = "/images/world-map-overlay.png";

function mapScaleForViewport(width: number) {
  if (width < 640) return { x: 2.62, y: 1.22, yOffset: -0.02 };
  if (width < 980) return { x: 3.34, y: 1.42, yOffset: -0.03 };
  return { x: 4.46, y: 1.86, yOffset: -0.05 };
}

function isInsideFallbackLand(x: number, y: number) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number, tilt = 0) => {
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const dx = x - cx;
    const dy = y - cy;
    const px = dx * cos + dy * sin;
    const py = -dx * sin + dy * cos;
    return (px * px) / (rx * rx) + (py * py) / (ry * ry) <= 1;
  };

  return (
    ellipse(-0.34, 0.16, 0.16, 0.11, -0.18) ||
    ellipse(-0.29, -0.03, 0.08, 0.16, 0.2) ||
    ellipse(-0.21, -0.27, 0.06, 0.18, -0.16) ||
    ellipse(0.03, 0.11, 0.09, 0.1, -0.22) ||
    ellipse(0.09, -0.12, 0.1, 0.18, 0.08) ||
    ellipse(0.26, 0.12, 0.23, 0.13, 0.02) ||
    ellipse(0.37, -0.08, 0.1, 0.08, -0.25) ||
    ellipse(0.33, -0.29, 0.08, 0.05, 0.04)
  );
}

function createFallbackMapCandidates() {
  const candidates: MapCandidate[] = [];
  for (let y = 0; y < 150; y += 1) {
    for (let x = 0; x < 280; x += 1) {
      const nx = x / 279 - 0.5;
      const ny = 0.5 - y / 149;
      if (isInsideFallbackLand(nx, ny)) candidates.push({ x: nx, y: ny });
    }
  }
  return candidates;
}

function assignMapTargets(candidates: MapCandidate[], count: number, viewportWidth: number, source: MapTargetData["source"]): MapTargetData {
  const scale = mapScaleForViewport(viewportWidth);
  const rand = createRandom(source === "mask" ? 82117 : 64291);
  const pool = candidates.length ? [...candidates] : createFallbackMapCandidates();

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const item = pool[i];
    pool[i] = pool[j];
    pool[j] = item;
  }

  const positions = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const candidate = pool[i % pool.length];
    const repeat = Math.floor(i / pool.length);
    const jitter = (repeat > 0 ? 0.012 : 0.006) + rand() * 0.006;
    const x = candidate.x + (rand() - 0.5) * jitter;
    const y = candidate.y + (rand() - 0.5) * jitter;
    positions[i * 3] = x * scale.x;
    positions[i * 3 + 1] = y * scale.y + scale.yOffset;
    positions[i * 3 + 2] = (rand() - 0.5) * 0.08;

    const centralCoherence = Math.abs(candidate.x) * 0.12 + Math.abs(candidate.y) * 0.035;
    const hemisphereOffset = candidate.x < -0.18 ? 0.03 : candidate.x > 0.18 ? 0.015 : 0;
    delays[i] = THREE.MathUtils.clamp(0.035, 0.36, centralCoherence + hemisphereOffset + rand() * 0.14);
  }

  return {
    positions,
    delays,
    candidateCount: pool.length,
    source,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

async function sampleWorldMapMask(count: number, viewportWidth: number): Promise<MapTargetData> {
  const image = await loadImage(WORLD_MAP_MASK_SRC);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return assignMapTargets(createFallbackMapCandidates(), count, viewportWidth, "fallback");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const candidates: MapCandidate[] = [];
  const step = viewportWidth < 640 ? 7 : viewportWidth < 980 ? 6 : 5;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const index = (y * canvas.width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      if (alpha > 28 && red > 135 && green > 135 && blue > 135 && red + green + blue > 560) {
        candidates.push({
          x: x / canvas.width - 0.5,
          y: 0.5 - y / canvas.height,
        });
      }
    }
  }

  return assignMapTargets(candidates, count, viewportWidth, candidates.length ? "mask" : "fallback");
}

export default function IdeaSphereCanvas({ storyMotionRef }: IdeaSphereCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const labelTextNodeRef = useRef<HTMLSpanElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const hoverIndexRef = useRef<number | null>(null);
  const labelTextRef = useRef("");
  const ideas = useMemo(() => IDEA_LABELS, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceMotion = () => reducedMotion.matches;
    const bounds = () => mount.getBoundingClientRect();
    const initial = bounds();
    const counts = pickCount(window.innerWidth);
    const rand = createRandom(39421);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, initial.width / initial.height, 0.1, 100);
    camera.position.set(0, 0, 3.55);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, initial.width < 760 ? 1.35 : 1.8);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(initial.width, initial.height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(counts.visual * 3);
    const colors = new Float32Array(counts.visual * 3);
    const sizes = new Float32Array(counts.visual);
    const alphas = new Float32Array(counts.visual);
    const baseSizes = new Float32Array(counts.visual);
    const baseAlphas = new Float32Array(counts.visual);
    const baseColors = new Float32Array(counts.visual * 3);
    const phases = new Float32Array(counts.visual);
    const amps = new Float32Array(counts.visual);
    const freqs = new Float32Array(counts.visual);
    const brightness = new Float32Array(counts.visual);
    const shatterVectors = new Float32Array(counts.visual * 3);
    const shatterDelays = new Float32Array(counts.visual);
    const shatterStrengths = new Float32Array(counts.visual);
    const shatterSeeds = new Float32Array(counts.visual);
    const fallbackMapData = assignMapTargets(createFallbackMapCandidates(), counts.visual, window.innerWidth, "fallback");
    const mapPositions = fallbackMapData.positions;
    const mapDelays = fallbackMapData.delays;
    const interactive: IdeaParticle[] = [];
    const shatterDirection = new THREE.Vector3();
    let disposed = false;

    const rear = new THREE.Color("#b5c7df");
    const soft = new THREE.Color("#d0e2fb");
    const mid = new THREE.Color("#afcdf7");
    const active = new THREE.Color("#82b5f5");
    const highlight = new THREE.Color("#5f9ef1");

    for (let i = 0; i < counts.visual; i += 1) {
      const direction = sphericalPoint(rand);
      const radius = layerRadius(rand);
      const localField =
        Math.sin(direction.x * 4.9 + direction.y * 2.2) * 0.052 +
        Math.sin(direction.y * 6.1 - direction.z * 3.7) * 0.04 +
        Math.cos(direction.x * 2.7 + direction.z * 5.6) * 0.031;
      const outerSpill = radius > 0.94 && rand() > 0.92 ? 0.025 + rand() * 0.035 : 0;
      const densityWave = 1 + localField + outerSpill + (rand() - 0.5) * 0.042;
      const base = direction.multiplyScalar(radius * densityWave);
      base.x *= 1.03 + (rand() - 0.5) * 0.052;
      base.y *= 1.09 + (rand() - 0.5) * 0.05;
      base.z *= 0.96 + (rand() - 0.5) * 0.052;

      positions[i * 3] = base.x;
      positions[i * 3 + 1] = base.y;
      positions[i * 3 + 2] = base.z;

      const depth = THREE.MathUtils.clamp((base.z + 1.1) / 2.2, 0, 1);
      const radial = THREE.MathUtils.clamp(base.length() / 1.12, 0, 1);
      const color = depth > 0.76 ? highlight : depth > 0.56 ? active : depth > 0.33 ? mid : rand() > 0.36 ? soft : rear;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      baseColors[i * 3] = color.r;
      baseColors[i * 3 + 1] = color.g;
      baseColors[i * 3 + 2] = color.b;

      const depthSize = depth < 0.28 ? 1.65 + rand() * 1.05 : depth < 0.62 ? 2.45 + rand() * 1.65 : 3.55 + rand() * 2.35;
      const shellBoost = 0.74 + radial * 0.48;
      sizes[i] = depthSize * shellBoost;
      alphas[i] = (0.13 + depth * 0.48 + rand() * 0.18) * (0.52 + radial * 0.56);
      baseSizes[i] = sizes[i];
      baseAlphas[i] = alphas[i];
      phases[i] = rand() * Math.PI * 2;
      amps[i] = 0.006 + rand() * 0.022;
      freqs[i] = 0.34 + rand() * 0.55;
      brightness[i] = 0.64 + rand() * 0.28 + depth * 0.54 + radial * 0.12;

      const seed = rand();
      const varianceX = (rand() - 0.5) * 0.72;
      const varianceY = (rand() - 0.5) * 0.58;
      const varianceZ = (rand() - 0.5) * 0.48;
      const horizontalSide = base.x >= 0 ? 1 : -1;
      const shellReleaseBias = THREE.MathUtils.smoothstep(radial, 0.45, 0.92);
      const horizontalBias = (0.08 + rand() * 0.28) * shellReleaseBias;
      shatterDirection.set(
        base.x * 1.38 + horizontalSide * horizontalBias + varianceX,
        base.y * 0.7 + varianceY,
        base.z * 0.42 + varianceZ,
      ).normalize();
      shatterVectors[i * 3] = shatterDirection.x;
      shatterVectors[i * 3 + 1] = shatterDirection.y;
      shatterVectors[i * 3 + 2] = shatterDirection.z;

      const regionalRelease =
        Math.sin(base.x * 3.1 + seed * Math.PI * 2) * 0.035 +
        Math.cos(base.y * 4.2 - seed * Math.PI) * 0.024;
      const radialDelay = THREE.MathUtils.lerp(0.62, 0.2, radial);
      shatterDelays[i] = THREE.MathUtils.clamp(0.16, 0.66, radialDelay + regionalRelease + (rand() - 0.5) * 0.085);
      shatterStrengths[i] = 0.2 + radial * 0.55 + rand() * 0.18;
      shatterSeeds[i] = seed;
    }

    const chosen = new Set<number>();
    while (interactive.length < counts.interactive && chosen.size < counts.visual) {
      const index = Math.floor(rand() * counts.visual);
      if (chosen.has(index)) continue;
      chosen.add(index);
      const base = new THREE.Vector3(
        positions[index * 3],
        positions[index * 3 + 1],
        positions[index * 3 + 2],
      );
      if (base.length() < 0.64) continue;
      interactive.push({
        index,
        label: ideas[interactive.length % ideas.length],
        base,
        phase: phases[index],
        amp: amps[index],
        freq: freqs[index],
        anchor: interactive.length % 7 === 0,
      });
    }

    for (const idea of interactive) {
      const i = idea.index;
      const anchorBoost = idea.anchor ? 1.42 : 1.18;
      sizes[i] = baseSizes[i] * anchorBoost;
      alphas[i] = Math.min(0.92, baseAlphas[i] * (idea.anchor ? 1.34 : 1.12));
      colors[i * 3] = THREE.MathUtils.lerp(baseColors[i * 3], highlight.r, idea.anchor ? 0.42 : 0.18);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(baseColors[i * 3 + 1], highlight.g, idea.anchor ? 0.42 : 0.18);
      colors[i * 3 + 2] = THREE.MathUtils.lerp(baseColors[i * 3 + 2], highlight.b, idea.anchor ? 0.42 : 0.18);
      baseSizes[i] = sizes[i];
      baseAlphas[i] = alphas[i];
      baseColors[i * 3] = colors[i * 3];
      baseColors[i * 3 + 1] = colors[i * 3 + 1];
      baseColors[i * 3 + 2] = colors[i * 3 + 2];
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aAmp", new THREE.BufferAttribute(amps, 1));
    geometry.setAttribute("aFreq", new THREE.BufferAttribute(freqs, 1));
    geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    geometry.setAttribute("aShatterVector", new THREE.BufferAttribute(shatterVectors, 3));
    geometry.setAttribute("aShatterDelay", new THREE.BufferAttribute(shatterDelays, 1));
    geometry.setAttribute("aShatterStrength", new THREE.BufferAttribute(shatterStrengths, 1));
    geometry.setAttribute("aShatterSeed", new THREE.BufferAttribute(shatterSeeds, 1));
    geometry.setAttribute("aMapPosition", new THREE.BufferAttribute(mapPositions, 3));
    geometry.setAttribute("aMapDelay", new THREE.BufferAttribute(mapDelays, 1));
    const sizeAttr = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const alphaAttr = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const mapPositionAttr = geometry.getAttribute("aMapPosition") as THREE.BufferAttribute;
    const mapDelayAttr = geometry.getAttribute("aMapDelay") as THREE.BufferAttribute;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uReduceMotion: { value: reduceMotion() ? 1 : 0 },
        uAbsorption: { value: 0 },
        uShatter: { value: 0 },
        uShatterScale: { value: shatterScaleForViewport(window.innerWidth) },
        uMapProgress: { value: 0 },
      },
    });

    const points = new THREE.Points(geometry, material);
    group.add(points);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 48, 48),
      new THREE.MeshBasicMaterial({
        color: "#d8e9fb",
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
      }),
    );
    aura.scale.set(1, 1.06, 0.94);
    group.add(aura);

    const screen = new THREE.Vector3();
    const world = new THREE.Vector3();
    const driftDirection = new THREE.Vector3();
    let animationId = 0;
    let visible = true;
    let width = initial.width;
    let height = initial.height;
    const start = performance.now();
    let visualHoverIndex: number | null = null;
    let pendingHoverIndex: number | null = null;
    let pendingHoverStarted = 0;
    let activeHoverIndex: number | null = null;

    sampleWorldMapMask(counts.visual, window.innerWidth)
      .then((mapData) => {
        if (disposed) return;
        mapPositionAttr.array.set(mapData.positions);
        mapDelayAttr.array.set(mapData.delays);
        mapPositionAttr.needsUpdate = true;
        mapDelayAttr.needsUpdate = true;
      })
      .catch(() => undefined);

    const restoreParticleVisual = (index: number | null) => {
      if (index === null) return;
      sizeAttr.setX(index, baseSizes[index]);
      alphaAttr.setX(index, baseAlphas[index]);
      colorAttr.setXYZ(
        index,
        baseColors[index * 3],
        baseColors[index * 3 + 1],
        baseColors[index * 3 + 2],
      );
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    };

    const setParticleHoverVisual = (index: number) => {
      if (visualHoverIndex === index) return;
      restoreParticleVisual(visualHoverIndex);
      visualHoverIndex = index;
      sizeAttr.setX(index, baseSizes[index] * 1.34);
      alphaAttr.setX(index, Math.min(1, baseAlphas[index] * 1.42));
      colorAttr.setXYZ(
        index,
        THREE.MathUtils.lerp(baseColors[index * 3], highlight.r, 0.55),
        THREE.MathUtils.lerp(baseColors[index * 3 + 1], highlight.g, 0.55),
        THREE.MathUtils.lerp(baseColors[index * 3 + 2], highlight.b, 0.55),
      );
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    };

    const setLabelHidden = () => {
      restoreParticleVisual(visualHoverIndex);
      visualHoverIndex = null;
      pendingHoverIndex = null;
      pendingHoverStarted = 0;
      activeHoverIndex = null;
      hoverIndexRef.current = null;
      labelTextRef.current = "";
      if (labelTextNodeRef.current) labelTextNodeRef.current.textContent = "";
      if (labelRef.current) {
        labelRef.current.style.opacity = "0";
        labelRef.current.style.visibility = "hidden";
        labelRef.current.style.transform = "translate3d(-9999px, -9999px, 0)";
      }
    };

    const projectIdea = (idea: IdeaParticle, elapsed: number) => {
      const drift = Math.sin(elapsed * idea.freq + idea.phase) * idea.amp;
      world.copy(idea.base);
      driftDirection.copy(idea.base).normalize();
      world.addScaledVector(driftDirection, drift);
      group.localToWorld(world);
      screen.copy(world).project(camera);
      if (
        !Number.isFinite(screen.x) ||
        !Number.isFinite(screen.y) ||
        !Number.isFinite(screen.z) ||
        screen.z < -1 ||
        screen.z > 1
      ) {
        return null;
      }
      const sx = (screen.x * 0.5 + 0.5) * width;
      const sy = (-screen.y * 0.5 + 0.5) * height;
      if (
        !Number.isFinite(sx) ||
        !Number.isFinite(sy) ||
        sx < 0 ||
        sx > width ||
        sy < 0 ||
        sy > height
      ) {
        return null;
      }
      return { x: sx, y: sy };
    };

    const updateHover = (elapsed: number) => {
      const storyMotion = storyMotionRef?.current;
      if (!pointerRef.current.inside || reduceMotion() || (storyMotion?.shatter ?? 0) > 0.02 || (storyMotion?.mapProgress ?? 0) > 0.02) {
        if (hoverIndexRef.current !== null) setLabelHidden();
        return;
      }

      const sphereCenterX = width / 2;
      const sphereCenterY = height / 2;
      const dxFromSphere = pointerRef.current.x - sphereCenterX;
      const dyFromSphere = pointerRef.current.y - sphereCenterY;
      const interactionRadius = Math.min(width, height) * 0.46;
      if (Math.sqrt(dxFromSphere * dxFromSphere + dyFromSphere * dyFromSphere) > interactionRadius) {
        if (hoverIndexRef.current !== null) setLabelHidden();
        return;
      }

      let nearest: IdeaParticle | null = null;
      let nearestDistance = 30;
      for (const idea of interactive) {
        const projected = projectIdea(idea, elapsed);
        if (!projected) continue;
        const dx = projected.x - pointerRef.current.x;
        const dy = projected.y - pointerRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = idea;
        }
      }

      if (!nearest) {
        if (hoverIndexRef.current !== null) setLabelHidden();
        pendingHoverIndex = null;
        pendingHoverStarted = 0;
        return;
      }

      if (pendingHoverIndex !== nearest.index) {
        restoreParticleVisual(visualHoverIndex);
        visualHoverIndex = null;
        activeHoverIndex = null;
        pendingHoverIndex = nearest.index;
        pendingHoverStarted = performance.now();
        if (labelRef.current) {
          labelRef.current.style.opacity = "0";
          labelRef.current.style.visibility = "hidden";
        }
        return;
      }

      if (activeHoverIndex !== nearest.index && performance.now() - pendingHoverStarted < 70) {
        return;
      }

      const projected = projectIdea(nearest, elapsed);
      if (!projected || pendingHoverIndex !== nearest.index) {
        if (hoverIndexRef.current !== null) setLabelHidden();
        return;
      }

      const placement = projectedLabelPlacement(projected.x, projected.y, width, height);
      const left = Math.max(14, Math.min(width - 168, placement.left));
      const top = Math.max(14, Math.min(height - 54, placement.top));
      if (!Number.isFinite(left) || !Number.isFinite(top) || (left === 0 && top === 0)) {
        if (hoverIndexRef.current !== null) setLabelHidden();
        return;
      }

      if (labelRef.current) {
        if (labelTextRef.current !== nearest.label && labelTextNodeRef.current) {
          labelTextNodeRef.current.textContent = nearest.label;
        }
        labelRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        labelRef.current.style.visibility = "visible";
        labelRef.current.style.opacity = "1";
      }
      activeHoverIndex = nearest.index;
      setParticleHoverVisual(nearest.index);

      if (hoverIndexRef.current !== nearest.index || labelTextRef.current !== nearest.label) {
        hoverIndexRef.current = nearest.index;
        labelTextRef.current = nearest.label;
      }
    };

    const render = () => {
      animationId = requestAnimationFrame(render);
      if (!visible) return;

      const elapsed = (performance.now() - start) / 1000;
      const reduced = reduceMotion();
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uReduceMotion.value = reduced ? 1 : 0;

      const storyMotion = storyMotionRef?.current;
      const absorption = storyMotion?.absorption ?? 0;
      const expansion = storyMotion?.expansion ?? 1;
      const rotationDamp = storyMotion?.rotationDamp ?? 1;
      const shatter = storyMotion?.shatter ?? 0;
      const mapProgress = storyMotion?.mapProgress ?? 0;
      material.uniforms.uAbsorption.value = reduced ? 0 : absorption;
      material.uniforms.uShatter.value = reduced ? 0 : shatter;
      material.uniforms.uMapProgress.value = mapProgress;
      const breath = reduced ? 1 : 1 + Math.sin(elapsed * 0.42) * 0.004;
      const mapRotationEase = THREE.MathUtils.smoothstep(mapProgress, 0.08, 0.86);
      const targetYaw = pointerRef.current.x && pointerRef.current.inside
        ? ((pointerRef.current.x / width) - 0.5) * 0.14 * (1 - mapRotationEase)
        : 0;
      const targetPitch = pointerRef.current.y && pointerRef.current.inside
        ? -((pointerRef.current.y / height) - 0.5) * 0.08 * (1 - mapRotationEase)
        : 0;

      group.rotation.y += reduced ? 0 : (0.00115 + Math.sin(elapsed * 0.18) * 0.00024) * rotationDamp * (1 - mapRotationEase);
      group.rotation.x += (targetPitch - group.rotation.x) * (0.045 + mapRotationEase * 0.05);
      group.rotation.z += (targetYaw - group.rotation.z) * (0.035 + mapRotationEase * 0.045);
      group.rotation.y += (0 - group.rotation.y) * mapRotationEase * 0.055;
      group.scale.setScalar(breath * expansion);
      const auraFade = reduced ? 0 : THREE.MathUtils.smoothstep(shatter, 0.18, 0.82);
      aura.material.opacity = (0.045 + absorption * 0.026) * (1 - auraFade);

      updateHover(elapsed);
      renderer.render(scene, camera);
    };

    const resize = () => {
      const rect = bounds();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      material.uniforms.uShatterScale.value = shatterScaleForViewport(window.innerWidth);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = bounds();
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
      pointerRef.current.inside = true;
    };

    const onPointerLeave = () => {
      pointerRef.current.inside = false;
      setLabelHidden();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    }, { threshold: 0.01 });

    const resizeObserver = new ResizeObserver(() => resize());

    observer.observe(mount);
    resizeObserver.observe(mount);
    window.addEventListener("resize", resize);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerleave", onPointerLeave);
    reducedMotion.addEventListener("change", setLabelHidden);
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerleave", onPointerLeave);
      reducedMotion.removeEventListener("change", setLabelHidden);
      geometry.dispose();
      material.dispose();
      aura.geometry.dispose();
      (aura.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ideas]);

  return (
    <div className="idea-sphere-canvas" ref={mountRef} aria-label="A field of traveler ideas transforming into a dotted world map">
      <div className="idea-sphere-vignette" aria-hidden="true" />
      <div
        ref={labelRef}
        className="idea-sphere-label"
        style={{ opacity: 0, visibility: "hidden", transform: "translate3d(-9999px, -9999px, 0)" }}
      >
        <span ref={labelTextNodeRef} />
        <small>Independent input</small>
      </div>
    </div>
  );
}
