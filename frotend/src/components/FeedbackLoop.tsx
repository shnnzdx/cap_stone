import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function FeedbackLoop({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.green} position={[1.46, 1.18, 0.16]} rotation={[0, 0, -0.24]} scale={[1.6, 0.06, 0.08]}>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[0.82, 0.84, 0.24]} rotation={[0, 0, -0.72]} scale={[0.94, 0.06, 0.08]}>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[0.42, 0.18, 0.42]} rotation={[0, 0, -1.18]} scale={[0.86, 0.06, 0.08]}>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[1.22, 0.9, -0.2]} rotation={[0, 0, -0.28]} scale={[1.1, 0.05, 0.07]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[0.58, 0.42, -0.22]} rotation={[0, 0, -0.9]} scale={[0.74, 0.05, 0.07]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
