import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function CandidateBuffer({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.concrete} position={[-0.55, 0.04, 0.02]} scale={[0.42, 1.62, 0.34]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[-0.38, 0.72, 0.3]} scale={[0.42, 0.08, 0.16]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[-0.38, 0.18, 0.3]} scale={[0.34, 0.08, 0.16]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[-0.38, -0.42, 0.28]} scale={[0.28, 0.08, 0.14]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.black} position={[-0.72, 0.04, -0.2]} scale={[0.08, 1.36, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[-0.44, 0.54, -0.22]} scale={[0.34, 0.06, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[-0.44, 0.1, -0.22]} scale={[0.3, 0.06, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[-0.44, -0.34, -0.22]} scale={[0.24, 0.06, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
