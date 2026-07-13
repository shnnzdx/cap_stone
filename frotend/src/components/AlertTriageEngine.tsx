import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SimulationEngine } from "../simulation/simulationEngine";
import type { StrategyMode } from "../simulation/alertTypes";
import { JobIntakeQueue } from "./JobIntakeQueue";
import { SignalExtractionLayer } from "./SignalExtractionLayer";
import { CandidateBuffer } from "./CandidateBuffer";
import { AdaptiveRankingCore } from "./AdaptiveRankingCore";
import { AlertOutput } from "./AlertOutput";
import { SuppressionReservoir } from "./SuppressionReservoir";
import { FeedbackLoop } from "./FeedbackLoop";
import { SceneLabels } from "./SceneLabels";

type AlertTriageEngineProps = {
  engineRef: MutableRefObject<SimulationEngine>;
  reducedMotion: boolean;
  isMobile: boolean;
  paused: boolean;
  onUiTick: () => void;
  strategy: StrategyMode;
};

function createNoiseTexture(base: string, speck: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = base;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 2600; index += 1) {
      context.fillStyle = `${speck}${Math.floor(Math.random() * 18).toString(16).padStart(2, "0")}`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }
  }
  return new CanvasTexture(canvas);
}

function createWedgeGeometry() {
  const shape = new Shape([
    new Vector2(-0.5, -0.5),
    new Vector2(0.5, -0.5),
    new Vector2(0.5, 0.08),
    new Vector2(-0.5, 0.5),
  ]);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

export function AlertTriageEngine({
  engineRef,
  reducedMotion,
  isMobile,
  paused,
  onUiTick,
  strategy,
}: AlertTriageEngineProps) {
  const groupRef = useRef<Group>(null);
  const jobRef = useRef<InstancedMesh>(null);
  const signalRef = useRef<InstancedMesh>(null);
  const candidateRef = useRef<InstancedMesh>(null);
  const feedbackRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const colorScratch = useMemo(() => new Color(), []);
  const lastUiTick = useRef(0);
  const dragState = useRef({ active: false, lastX: 0, lastY: 0 });
  const dragOffset = useRef({ rotX: 0, rotY: 0 });
  const viewState = useRef({
    x: 0.44,
    y: 0.4,
    scale: 1.08,
    rotX: -0.08,
    rotY: 0.28,
    rotZ: 0,
  });

  useEffect(() => {
    dragState.current.active = false;
    dragOffset.current = { rotX: 0, rotY: 0 };
    document.body.style.cursor = "";
  }, [strategy]);

  const geometries = useMemo(
    () => ({
      unit: new RoundedBoxGeometry(1, 1, 1, 6, 0.05),
      signal: createWedgeGeometry(),
      plane: new PlaneGeometry(5.4, 5.4),
    }),
    [],
  );

  const materials = useMemo(() => {
    const concreteTexture = createNoiseTexture("#d8d6d0", "#26231f");
    const blackTexture = createNoiseTexture("#111111", "#f5f5ed");
    return {
      concrete: new MeshStandardMaterial({
        color: "#d9d7d0",
        map: concreteTexture,
        roughness: 0.92,
        metalness: 0,
      }),
      black: new MeshStandardMaterial({
        color: "#101010",
        map: blackTexture,
        roughness: 0.88,
        metalness: 0,
      }),
      yellow: new MeshStandardMaterial({ color: "#f3e600", roughness: 0.72, metalness: 0 }),
      green: new MeshStandardMaterial({ color: "#a9e8b5", roughness: 0.78, metalness: 0 }),
      pink: new MeshStandardMaterial({ color: "#ff6f82", roughness: 0.7, metalness: 0 }),
      muted: new MeshStandardMaterial({ color: "#a9a8a2", roughness: 0.86, metalness: 0 }),
      shadow: new MeshStandardMaterial({
        color: "#d3d0c8",
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: isMobile ? 0.16 : 0.28,
      }),
    };
  }, [isMobile]);

  const paintUnits = (mesh: InstancedMesh | null, units: ReturnType<SimulationEngine["getActiveAlerts"]>) => {
    void mesh;
    void units;
  };

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    engineRef.current.update(elapsed, paused || reducedMotion);

    const group = groupRef.current;
    if (group) {
      const target =
        strategy === "feedback"
          ? { x: 0.44, y: 0.4, scale: 1.08, rotX: -0.08, rotY: 0.28, rotZ: 0.0 }
          : strategy === "threshold"
            ? { x: 0.66, y: 0.46, scale: 1.04, rotX: -0.16, rotY: -1.08, rotZ: 0.06 }
            : { x: 0.16, y: 0.34, scale: 1.1, rotX: -0.18, rotY: -2.36, rotZ: 0.08 };
      const amount = reducedMotion ? 1 : 0.045;
      viewState.current.x += (target.x - viewState.current.x) * amount;
      viewState.current.y += (target.y - viewState.current.y) * amount;
      viewState.current.scale += (target.scale - viewState.current.scale) * amount;
      viewState.current.rotX += (target.rotX - viewState.current.rotX) * amount;
      viewState.current.rotY += (target.rotY - viewState.current.rotY) * amount;
      viewState.current.rotZ += (target.rotZ - viewState.current.rotZ) * amount;

      group.rotation.set(
        viewState.current.rotX + dragOffset.current.rotX,
        viewState.current.rotY + dragOffset.current.rotY + Math.sin(elapsed * 0.12) * 0.01,
        viewState.current.rotZ,
      );
      group.position.x = viewState.current.x;
      group.position.y = viewState.current.y + Math.sin(elapsed * 0.32) * (reducedMotion ? 0 : 0.012);
      group.scale.setScalar(viewState.current.scale);
    }

    updateInstancedMesh(jobRef.current, engineRef.current.jobs, "job", elapsed);
    updateInstancedMesh(signalRef.current, engineRef.current.signals, "signal", elapsed);
    updateInstancedMesh(candidateRef.current, engineRef.current.candidates, "candidate", elapsed);
    updateInstancedMesh(feedbackRef.current, engineRef.current.feedback, "feedback", elapsed);

    if (elapsed - lastUiTick.current > 0.75) {
      lastUiTick.current = elapsed;
      onUiTick();
    }
  });

  const updateInstancedMesh = (
    mesh: InstancedMesh | null,
    units: SimulationEngine["jobs"],
    kind: "job" | "signal" | "candidate" | "feedback",
    elapsed: number,
  ) => {
    if (!mesh) return;
    units.forEach((unit, index) => {
      const activeScale = unit.active ? 1 : 0.001;
      const saturation = unit.lifecycleState === "suppressed" || unit.lifecycleState === "recycling" ? 0.55 : 1;
      const unitScale = activeScale * unit.visualScale;
      dummy.position.set(unit.currentPosition[0], unit.currentPosition[1], unit.currentPosition[2]);
      dummy.rotation.set(
        Math.sin(elapsed * 0.7 + unit.phaseOffset) * 0.08,
        elapsed * 0.08 + unit.phaseOffset,
        Math.cos(elapsed * 0.5 + unit.phaseOffset) * 0.05,
      );
      const base =
        kind === "signal"
          ? [0.13, 0.1, 0.18]
          : kind === "feedback"
            ? [0.13, 0.13, 0.13]
            : kind === "job"
              ? [0.2, 0.16, 0.22]
              : [0.24, 0.18, 0.22];
      dummy.scale.set(base[0] * unitScale, base[1] * unitScale, base[2] * unitScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      setUnitColor(colorScratch, unit.lifecycleState, unit.utility, unit.finalDecision, kind, saturation);
      mesh.setColorAt(index, colorScratch);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    dragState.current = { active: true, lastX: event.clientX, lastY: event.clientY };
    (event.currentTarget as unknown as Element).setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragState.current.active) return;
    event.stopPropagation();
    const deltaX = event.clientX - dragState.current.lastX;
    const deltaY = event.clientY - dragState.current.lastY;
    dragState.current.lastX = event.clientX;
    dragState.current.lastY = event.clientY;
    dragOffset.current.rotY += deltaX * 0.006;
    dragOffset.current.rotX = Math.max(-0.7, Math.min(0.7, dragOffset.current.rotX + deltaY * 0.004));
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    dragState.current.active = false;
    event.stopPropagation();
    (event.currentTarget as unknown as Element).releasePointerCapture(event.pointerId);
    document.body.style.cursor = "";
  };

  useEffect(() => {
    paintUnits(null, []);
    return () => {
      Object.values(geometries).forEach((geometry: BufferGeometry) => geometry.dispose());
      Object.values(materials).forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    };
  }, [geometries, materials]);

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        dragState.current.active = false;
        document.body.style.cursor = "";
      }}
    >
      <mesh
        geometry={geometries.plane}
        material={materials.shadow}
        position={[0.1, -2.12, -0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
      <JobIntakeQueue materials={materials} />
      <SignalExtractionLayer materials={materials} />
      <CandidateBuffer materials={materials} />
      <AdaptiveRankingCore engineRef={engineRef} materials={materials} />
      <AlertOutput materials={materials} />
      <SuppressionReservoir materials={materials} />
      <FeedbackLoop materials={materials} />
      <SceneLabels />
      <instancedMesh
        ref={jobRef}
        args={[geometries.unit, materials.concrete, engineRef.current.jobs.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={signalRef}
        args={[geometries.signal, materials.yellow, engineRef.current.signals.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={candidateRef}
        args={[geometries.unit, materials.yellow, engineRef.current.candidates.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={feedbackRef}
        args={[geometries.unit, materials.green, engineRef.current.feedback.length]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

function setUnitColor(
  target: Color,
  state: string,
  utility: number,
  decision: string,
  kind: string,
  saturation: number,
) {
  if (kind === "feedback" || state === "feedback") {
    target.set("#8fe3a2");
  } else if (state === "queued" || state === "compressing" || state === "absorbing") {
    target.set("#f3e600");
  } else if (decision === "promote" && utility > 0.58) {
    target.set("#ff6f82");
  } else if (state === "suppressed" || state === "recycling") {
    target.setRGB(0.48 * saturation, 0.48 * saturation, 0.45 * saturation);
  } else if (kind === "signal") {
    target.set("#f3e600");
  } else if (kind === "job") {
    target.set("#d9d7d0");
  } else {
    target.set("#f3e600");
  }
}
