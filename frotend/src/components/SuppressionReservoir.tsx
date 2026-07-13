import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function SuppressionReservoir({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.muted} position={[1.64, -1.42, 0.04]} scale={[1.42, 0.34, 0.48]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[1.12, -1.08, 0.2]} scale={[0.34, 0.18, 0.26]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[1.78, -1.02, 0.2]} scale={[0.42, 0.18, 0.26]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.black} position={[1.62, -1.7, -0.18]} scale={[1.18, 0.08, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[1.16, -1.3, -0.22]} scale={[0.24, 0.1, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[1.58, -1.24, -0.22]} scale={[0.3, 0.1, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.muted} position={[2.02, -1.18, -0.22]} scale={[0.34, 0.1, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
