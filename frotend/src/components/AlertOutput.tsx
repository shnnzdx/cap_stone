import type { MeshStandardMaterial } from "three";

type Materials = Record<string, MeshStandardMaterial>;

export function AlertOutput({ materials }: { materials: Materials }) {
  return (
    <group>
      <mesh material={materials.yellow} position={[1.55, 0.78, 0.12]} scale={[1.18, 0.18, 0.34]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.pink} position={[2.28, 0.86, 0.28]} scale={[0.42, 0.36, 0.34]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.concrete} position={[2.64, 0.48, 0.08]} scale={[0.18, 0.86, 0.42]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.black} position={[2.22, 0.72, -0.18]} scale={[0.74, 0.08, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.pink} position={[2.52, 0.92, -0.18]} scale={[0.28, 0.16, 0.1]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
      <mesh material={materials.yellow} position={[1.72, 0.56, -0.2]} scale={[0.66, 0.08, 0.08]} castShadow receiveShadow>
        <boxGeometry />
      </mesh>
    </group>
  );
}
