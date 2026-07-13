import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function RankingCore({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.black} position={[0.22, -0.1, 0.12]} scale={[0.78, 1.52, 0.72]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.pink} position={[0.02, 0.52, 0.58]} scale={[0.38, 0.26, 0.28]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.green} position={[0.38, -0.58, 0.58]} scale={[0.3, 0.38, 0.24]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.concrete} position={[0.24, 1.03, 0.06]} scale={[1.12, 0.22, 0.56]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
