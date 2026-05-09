/// <reference types="vite/client" />

interface FaceLumeBridge {
  isElectron: true;
  platform: string;
  minimize: () => void;
  maximizeToggle: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    facelume?: FaceLumeBridge;
  }
}

export {};
