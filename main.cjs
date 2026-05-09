const { app, BrowserWindow, session, shell } = require("electron");
const path = require("path");

// The desktop app is a thin native wrapper around the hosted web app.
// All auth, activation, payment, credit, and streaming logic lives on
// the server — Electron only provides the window, persistent session,
// and camera/microphone access.
const PRODUCTION_APP_URL = "https://www.getfacelume.com";

const normalizeAppUrl = (candidate) => {
  try {
    const url = new URL(candidate || PRODUCTION_APP_URL);
    const isLovablePreview =
      url.hostname.includes("id-preview--") ||
      url.hostname.endsWith("lovable.app");

    // Never let a distributed desktop build open Lovable editor/preview URLs;
    // those are project-private and trigger the Lovable authentication screen.
    if (isLovablePreview) return PRODUCTION_APP_URL;
    return url.toString();
  } catch {
    return PRODUCTION_APP_URL;
  }
};

const RAW_APP_URL = normalizeAppUrl(process.env.FACELUME_APP_URL);

// Always load the base origin (e.g. https://yourdomain.com) and let the
// web app's React Router decide where to send the user:
//   - not authed       → /get-started (login)
//   - authed, !active  → /activate
//   - authed + active  → /app
// Loading a deep path like /app directly would 404 on a hard refresh
// before the SPA router has hydrated, so we strip any path/query/hash
// from APP_URL.
const APP_URL = (() => {
  try {
    return new URL(RAW_APP_URL).origin;
  } catch {
    return RAW_APP_URL;
  }
})();

// Persist Supabase auth (localStorage) across launches by giving the
// session a stable on-disk partition.
const SESSION_PARTITION = "persist:facelume";

function createWindow() {
  const ses = session.fromPartition(SESSION_PARTITION, { cache: true });

  // Auto-grant camera + microphone for our own origin so the studio
  // (/app) can capture media without an OS-style prompt loop.
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "mediaKeySystem") {
      return callback(true);
    }
    callback(true);
  });
  ses.setPermissionCheckHandler(() => true);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0614",
    title: "FaceLume",
    autoHideMenuBar: true,
    webPreferences: {
      partition: SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.loadURL(APP_URL);

  // Atlos opens a popup wallet checkout. Keep popups inside the desktop
  // app (new BrowserWindow on the same partition) so the Supabase
  // session is shared. External http(s) navigations from explicit user
  // intent (e.g. "Open in browser") still go to the OS browser via the
  // `will-navigate` guard below if they leave our origin.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const here = new URL(APP_URL);
      // Allow same-origin popups (Atlos checkout iframe wrapper, OAuth)
      // to open as child windows that share the session partition.
      if (target.origin === here.origin || target.hostname.endsWith("atlos.io")) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 520,
            height: 760,
            backgroundColor: "#0a0614",
            autoHideMenuBar: true,
            webPreferences: {
              partition: SESSION_PARTITION,
              contextIsolation: true,
              nodeIntegration: false,
            },
          },
        };
      }
    } catch {
      // fallthrough → open externally
    }
    shell.openExternal(url);
    return { action: "deny" };
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
