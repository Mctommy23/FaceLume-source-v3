# FaceLume — Build the Electron Desktop App locally

This is the **full source** of the FaceLume Electron desktop app.
The desktop app is a thin native wrapper around the hosted web app
(`https://www.getfacelume.com`) — auth, payments, credits
and streaming all run server-side. Electron only provides the window,
persistent session, camera/mic access, and the native chrome.

## Requirements

- Node.js 18+ (Node 20 recommended)
- npm (or bun / pnpm)
- Windows / macOS / Linux

## 1. Install dependencies

```bash
npm install
```

## 2. Build the web frontend

The Electron main process loads the production Vite build from `dist/`.

```bash
npm run build
```

> `vite.config.ts` already sets `base: './'` so assets resolve under
> `file://` when packaged.

## 3. Run the app in dev (against the hosted web app)

```bash
npx electron .
```

The default URL is the production domain:
`https://www.getfacelume.com`

To point the desktop app at a different deployment:

```bash
# macOS / Linux
FACELUME_APP_URL="https://www.getfacelume.com" npx electron .

# Windows (PowerShell)
$env:FACELUME_APP_URL="https://www.getfacelume.com"; npx electron .
```

## 4. Package a portable build (no installer)

Uses `@electron/packager`. Produces a folder containing the runnable app.

```bash
# Windows x64
npx @electron/packager . "FaceLume" --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore="^/src" --ignore="^/public" --ignore="^/electron-release" \
  --ignore="^/supabase" --ignore="^/node_modules/(?!(electron|@electron))"

# macOS arm64
npx @electron/packager . "FaceLume" --platform=darwin --arch=arm64 \
  --out=electron-release --overwrite

# Linux x64
npx @electron/packager . "FaceLume" --platform=linux --arch=x64 \
  --out=electron-release --overwrite
```

Run the packaged app:
- Windows: `electron-release/FaceLume-win32-x64/FaceLume.exe`
- macOS:   `electron-release/FaceLume-darwin-arm64/FaceLume.app`
- Linux:   `electron-release/FaceLume-linux-x64/FaceLume`

## 5. Build a real installer with electron-builder

`electron-builder.yml` is included. Install the dev dep and run:

```bash
npm install --save-dev electron-builder
npm run dist           # builds installer for current OS
npm run dist:win       # NSIS .exe installer
npm run dist:mac       # .dmg (must run on macOS for signing)
npm run dist:linux     # AppImage + deb
```

Output is written to `dist-installers/`.

> **Note:** electron-builder must run on the target OS for signed
> installers. Cross-compiling unsigned installers from Linux works for
> Windows (`--win`) but not for macOS `.dmg`.

## Project layout

```
electron/
  main.cjs         Main process (window, IPC, navigation guard)
  preload.cjs      Safe IPC bridge exposed as `window.facelume`
src/               React frontend (Vite + Tailwind + shadcn)
  components/electron/
    ElectronShell.tsx   Custom title bar + splash + studio body tag
    TitleBar.tsx        Minimize / maximize / close controls
dist/              Vite build output (created by `npm run build`)
electron-builder.yml    Installer config
package.json            `"main": "electron/main.cjs"`
vite.config.ts          `base: './'` for file:// loading
```

## Customising

- **Window size / colors**: `electron/main.cjs` → `BrowserWindow` options.
- **Allowed routes**: `electron/main.cjs` → `ALLOWED_PATH_PREFIXES`.
- **Title bar**: `src/components/electron/TitleBar.tsx`.
- **Splash**: `src/components/electron/ElectronShell.tsx`.
- **App icon**: replace `build/icon.png` (512×512), `build/icon.ico`
  (Windows), `build/icon.icns` (macOS), then rebuild.
