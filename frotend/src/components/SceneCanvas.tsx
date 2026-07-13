import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import type { MutableRefObject } from "react";
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from "three";
import { Lighting } from "./Lighting";
import { AlertTriageEngine } from "./AlertTriageEngine";
import { useResponsiveScene } from "../hooks/useResponsiveScene";
import type { SimulationEngine } from "../simulation/simulationEngine";
import type { StrategyMode } from "../simulation/alertTypes";

type SceneCanvasProps = {
  progressRef: MutableRefObject<number>;
  engineRef: MutableRefObject<SimulationEngine>;
  reducedMotion: boolean;
  paused: boolean;
  onUiTick: () => void;
  strategy: StrategyMode;
};

function CameraTarget() {
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0, 0.25, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

export function SceneCanvas({ progressRef, engineRef, reducedMotion, paused, onUiTick, strategy }: SceneCanvasProps) {
  const { dpr, cameraZoom, isMobile } = useResponsiveScene();
  void progressRef;

  return (
    <Canvas
      className="scene-canvas"
      shadows={isMobile ? false : { type: PCFShadowMap }}
      dpr={dpr}
      orthographic
      camera={{ position: [5.2, 3.2, 7.4], zoom: cameraZoom, near: 0.1, far: 80 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.setClearColor("#000000", 0);
      }}
    >
      <CameraTarget />
      <Suspense fallback={null}>
        <Lighting isMobile={isMobile} />
        <AlertTriageEngine
          engineRef={engineRef}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          paused={paused}
          onUiTick={onUiTick}
          strategy={strategy}
        />
      </Suspense>
    </Canvas>
  );
}
