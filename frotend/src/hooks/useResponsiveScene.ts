import { useEffect, useState } from "react";

type SceneSettings = {
  dpr: [number, number];
  cameraZoom: number;
  isMobile: boolean;
};

function getSettings(): SceneSettings {
  const width = window.innerWidth;
  return {
    dpr: [1, 1.75],
    cameraZoom: width > 1400 ? 154 : 140,
    isMobile: false,
  };
}

export function useResponsiveScene() {
  const [settings, setSettings] = useState<SceneSettings>(() => getSettings());

  useEffect(() => {
    const update = () => setSettings(getSettings());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return settings;
}
