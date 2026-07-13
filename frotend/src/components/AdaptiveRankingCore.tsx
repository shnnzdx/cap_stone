import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { Group, Mesh, MeshStandardMaterial } from "three";
import type { SimulationEngine } from "../simulation/simulationEngine";

type Materials = Record<string, MeshStandardMaterial>;

type AdaptiveRankingCoreProps = {
  engineRef: MutableRefObject<SimulationEngine>;
  materials: Materials;
};

function slotPosition(slotId: number, compression: number, ranking: number, decision?: "promote" | "suppress") {
  const col = slotId % 4;
  const row = Math.floor((slotId % 16) / 4);
  const depth = Math.floor(slotId / 16);
  const spacingX = 0.28 - compression * 0.035;
  const spacingY = 0.26 - compression * 0.028;
  const x = -0.2 + (col - 1.5) * spacingX + ranking * (decision === "promote" ? 0.18 : decision === "suppress" ? 0.08 : 0);
  const y = -0.26 + (row - 1.5) * spacingY + ranking * (decision === "promote" ? 0.22 : decision === "suppress" ? -0.2 : 0);
  const z = 0.54 + depth * 0.24;
  return [x, y, z] as const;
}

export function AdaptiveRankingCore({ engineRef, materials }: AdaptiveRankingCoreProps) {
  const coreGroupRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const topPanelRef = useRef<Mesh>(null);
  const intakeGateRef = useRef<Mesh>(null);
  const pinkScoringModuleRef = useRef<Mesh>(null);
  const greenFeedbackMemoryRef = useRef<Mesh>(null);
  const slotRefs = useRef<Array<Mesh | null>>([]);
  const voxelRefs = useRef<Array<Mesh | null>>([]);

  const slotIds = useMemo(() => Array.from({ length: 32 }, (_, index) => index), []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const state = engineRef.current.getCoreVisualState(elapsed);
    const compression = state.compressionProgress;
    const ranking = state.rankingProgress;
    const release = state.releaseProgress;
    const occupiedBySlot = new Map(state.occupiedSlots.map((slot) => [slot.slotId, slot]));

    if (coreGroupRef.current) {
      coreGroupRef.current.position.y = Math.sin(elapsed * 0.42) * 0.01;
      coreGroupRef.current.scale.setScalar(1 - compression * 0.018 + Math.sin(elapsed * 0.5) * 0.003);
    }

    if (frameRef.current) {
      frameRef.current.scale.set(1 - compression * 0.025, 1 - compression * 0.018, 1);
    }

    if (topPanelRef.current) {
      topPanelRef.current.position.y = 1.06 - compression * 0.18 + (state.phase === "filling" ? 0.04 : 0);
      topPanelRef.current.rotation.z = -0.04 + compression * 0.04;
    }

    if (intakeGateRef.current) {
      intakeGateRef.current.position.x = -0.78 + compression * 0.18;
      intakeGateRef.current.scale.y = 0.74 - compression * 0.22;
    }

    if (pinkScoringModuleRef.current) {
      pinkScoringModuleRef.current.position.z = 0.61 + ranking * 0.16;
      pinkScoringModuleRef.current.scale.setScalar(1 + ranking * 0.22);
    }

    if (greenFeedbackMemoryRef.current) {
      greenFeedbackMemoryRef.current.position.y = 1.2 + state.feedbackPulse * 0.08;
      greenFeedbackMemoryRef.current.scale.x = 1 + state.feedbackPulse * 0.16;
    }

    slotIds.forEach((slotId) => {
      const slot = slotRefs.current[slotId];
      const voxel = voxelRefs.current[slotId];
      const occupied = occupiedBySlot.get(slotId);
      const pos = slotPosition(slotId, compression, ranking, occupied?.decision);
      if (slot) {
        slot.position.set(pos[0], pos[1], pos[2]);
        slot.scale.set(0.19, 0.15, 0.15);
      }
      if (voxel) {
        voxel.position.set(pos[0], pos[1], pos[2]);
        const baseScale = occupied ? 1 : 0.001;
        const releasingScale = occupied?.state === "releasing" ? Math.max(0.001, 1 - release * 0.92) : 1;
        const dockingScale = occupied?.state === "docking" ? 0.72 + Math.sin(elapsed * 4 + slotId) * 0.03 : 1;
        voxel.scale.set(0.2 * baseScale * releasingScale * dockingScale, 0.16 * baseScale * releasingScale, 0.16 * baseScale * releasingScale);
        voxel.rotation.set(0, ranking * 0.18, 0);
      }
    });
  });

  return (
    <group ref={coreGroupRef}>
      <group ref={frameRef}>
        <mesh material={materials.black} position={[0.22, -0.1, 0.04]} scale={[0.94, 1.56, 0.12]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.black} position={[0.22, -0.92, 0.42]} scale={[1.05, 0.12, 0.7]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.black} position={[0.22, 0.76, 0.42]} scale={[1.05, 0.12, 0.7]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.black} position={[0.82, -0.1, 0.42]} scale={[0.12, 1.5, 0.7]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.concrete} position={[0.18, -0.08, -0.12]} scale={[0.86, 1.3, 0.08]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.black} position={[0.18, -0.08, -0.19]} scale={[0.72, 1.08, 0.035]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.yellow} position={[-0.14, 0.42, -0.23]} scale={[0.16, 0.58, 0.045]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.yellow} position={[0.18, 0.42, -0.23]} scale={[0.16, 0.58, 0.045]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.yellow} position={[0.5, 0.42, -0.23]} scale={[0.16, 0.58, 0.045]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.muted} position={[-0.08, -0.54, -0.23]} scale={[0.54, 0.1, 0.045]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh material={materials.pink} position={[0.46, -0.54, -0.23]} scale={[0.34, 0.1, 0.045]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh ref={intakeGateRef} material={materials.concrete} position={[-0.78, -0.16, 0.44]} scale={[0.12, 0.74, 0.5]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
        <mesh ref={topPanelRef} material={materials.concrete} position={[0.1, 1.06, 0.44]} scale={[1.12, 0.18, 0.62]} castShadow receiveShadow>
          <boxGeometry />
        </mesh>
      </group>

      {slotIds.map((slotId) => (
        <mesh
          key={`slot-${slotId}`}
          ref={(node) => {
            slotRefs.current[slotId] = node;
          }}
          material={materials.muted}
          scale={[0.19, 0.15, 0.15]}
          receiveShadow
        >
          <boxGeometry />
        </mesh>
      ))}

      {slotIds.map((slotId) => (
        <mesh
          key={`voxel-${slotId}`}
          ref={(node) => {
            voxelRefs.current[slotId] = node;
          }}
          material={materials.yellow}
          scale={[0.001, 0.001, 0.001]}
          castShadow
          receiveShadow
        >
          <boxGeometry />
        </mesh>
      ))}

      <mesh ref={pinkScoringModuleRef} material={materials.pink} position={[0.72, 0.2, 0.58]} scale={[0.22, 0.34, 0.24]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh ref={greenFeedbackMemoryRef} material={materials.green} position={[0.12, 1.2, 0.74]} scale={[0.78, 0.08, 0.12]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.pink} position={[1.1, 0.56, 0.5]} scale={[0.34, 0.16, 0.18]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[1.04, -0.78, 0.24]} scale={[0.36, 0.14, 0.18]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[0.96, 0.18, -0.18]} scale={[0.08, 0.92, 0.06]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[0.7, 0.18, -0.22]} scale={[0.08, 0.62, 0.05]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
