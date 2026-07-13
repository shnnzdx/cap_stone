type LightingProps = {
  isMobile: boolean;
};

export function Lighting({ isMobile }: LightingProps) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <rectAreaLight
        width={5.5}
        height={4.2}
        intensity={6.5}
        position={[-3.6, 5.2, 4.4]}
        rotation={[-0.65, -0.45, -0.28]}
      />
      <directionalLight
        castShadow={!isMobile}
        intensity={2.4}
        position={[-3.4, 5.4, 4.2]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight intensity={0.75} position={[4.5, 2.6, 3.8]} />
    </>
  );
}
