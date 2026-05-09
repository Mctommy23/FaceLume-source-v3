const { app, BrowserWindow, session, shell, ipcMain, Menu } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

// Native build: load the bundled React app from disk (file://) so the
// desktop app does NOT depend on a remote URL and never shows the
// Lovable preview / project authentication screen.
const SESSION_PARTITION = "persist:facelume";

Menu.setApplicationMenu(null);

function createWindow() {
  const ses = session.fromPartition(SESSION_PARTITION, { cache: true });
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media" || permission === "mediaKeySystem") return callback(true);
    callback(true);
  });
  ses.setPermissionCheckHandler(() => true);

  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  const iconPath = path.join(__dirname, "..", "build", iconFile);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0614",
    title: "FaceLume",
    icon: iconPath,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    thickFrame: true,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      partition: SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.once("ready-to-show", () => win.show());

  // Load the locally bundled web app. Vite is configured with
  // `base: './'` so file:// asset paths resolve correctly.
  const indexHtml = path.join(__dirname, "..", "dist", "index.html");
  win.loadURL(pathToFileURL(indexHtml).toString());

  // ---- Window control IPC ----
  ipcMain.on("window:minimize", (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  ipcMain.on("window:maximize-toggle", (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (w.isMaximized()) w.unmaximize(); else w.maximize();
  });
  ipcMain.on("window:close", (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
  ipcMain.handle("window:is-maximized", (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
  });
  ipcMain.on("shell:open-external", (_e, url) => {
    try {
      const target = new URL(url);
      if (target.protocol === "http:" || target.protocol === "https:") {
        shell.openExternal(target.toString());
      }
    } catch { /* ignore */ }
  });
  win.on("maximize", () => win.webContents.send("window:maximize-change", true));
  win.on("unmaximize", () => win.webContents.send("window:maximize-change", false));

  // Block reload + devtools shortcuts so it feels like a native app
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = (input.key || "").toLowerCase();
    const ctrlOrCmd = input.control || input.meta;
    const blocked =
      key === "f5" || key === "f11" || key === "f12" ||
      (ctrlOrCmd && key === "r") ||
      (ctrlOrCmd && input.shift && key === "r") ||
      (ctrlOrCmd && input.shift && key === "i") ||
      (ctrlOrCmd && input.shift && key === "j") ||
      (ctrlOrCmd && key === "u");
    if (blocked) event.preventDefault();
  });

  // External http(s) links open in the user's default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === "http:" || target.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch { /* ignore */ }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    // Only allow file:// (in-app SPA) navigation. Anything else opens externally.
    if (!url.startsWith("file://")) {
      event.preventDefault();
      try {
        const target = new URL(url);
        if (target.protocol === "http:" || target.protocol === "https:") {
          shell.openExternal(url);
        }
      } catch { /* ignore */ }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
