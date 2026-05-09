const { contextBridge, ipcRenderer } = require("electron");

// Minimal, safe surface exposed to the web app so the in-app custom
// title bar can drive native window controls.
contextBridge.exposeInMainWorld("facelume", {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send("window:minimize"),
  maximizeToggle: () => ipcRenderer.send("window:maximize-toggle"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  openExternal: (url) => ipcRenderer.send("shell:open-external", url),
  onMaximizeChange: (cb) => {
    const handler = (_e, value) => cb(Boolean(value));
    ipcRenderer.on("window:maximize-change", handler);
    return () => ipcRenderer.removeListener("window:maximize-change", handler);
  },
});
