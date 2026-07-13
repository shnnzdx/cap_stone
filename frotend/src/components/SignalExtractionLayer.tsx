import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function SignalExtractionLayer({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.concrete} position={[-1.38, -0.36, 0.04]} scale={[0.24, 1.36, 0.42]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[-1.28, 0.28, 0.32]} scale={[0.18, 0.18, 0.18]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[-1.28, -0.18, 0.32]} scale={[0.14, 0.14, 0.14]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[-1.28, -0.58, 0.32]} scale={[0.16, 0.16, 0.16]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.black} position={[-1.52, -0.36, -0.18]} scale={[0.08, 1.08, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[-1.32, 0.26, -0.22]} scale={[0.14, 0.14, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[-1.32, -0.16, -0.22]} scale={[0.12, 0.12, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[-1.32, -0.54, -0.22]} scale={[0.14, 0.14, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
