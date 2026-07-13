import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function JobIntakeQueue({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.concrete} position={[-2.78, -1.24, 0]} scale={[1.25, 0.18, 0.54]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.black} position={[-2.08, -1.0, 0.08]} scale={[0.12, 0.85, 0.42]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[-2.58, -0.82, 0.12]} scale={[0.74, 0.08, 0.22]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
