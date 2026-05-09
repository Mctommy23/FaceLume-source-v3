import { useEffect, useState } from "react";
import logoMark from "@/assets/facelume-mark.png";

/**
 * Custom Windows 11–style title bar shown only when the app is running
 * inside the Electron desktop shell. Uses the `window.facelume` bridge
 * exposed by electron/preload.cjs.
 *
 * Sizing matches native Windows:
 *   - 32px tall title bar
 *   - 46px wide caption controls
 *   - 10px Segoe-style SVG glyphs
 *   - close button turns #E81123 on hover (Windows red)
 */
export const TitleBar = () => {
  const api = (typeof window !== "undefined" ? (window as any).facelume : null) as
    | {
        minimize: () => void;
        maximizeToggle: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximizeChange: (cb: (v: boolean) => void) => () => void;
      }
    | null;

  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!api) return;
    api.isMaximized().then(setMaximized).catch(() => {});
    const off = api.onMaximizeChange(setMaximized);
    return off;
  }, [api]);

  if (!api) return null;

  // Windows 11 caption-control glyphs (10×10 viewBox, 1px stroke).
  const MinimizeGlyph = (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5 H10" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
  const MaximizeGlyph = (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
  const RestoreGlyph = (
    // Two overlapping squares, exactly like Win11's restore.
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M2.5 2.5 H9.5 V9.5 H2.5 Z M0.5 0.5 H7.5 V7.5 H0.5 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        fillRule="evenodd"
      />
    </svg>
  );
  const CloseGlyph = (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );

  return (
    <div
      className="flex items-center justify-between h-8 select-none bg-background/95 border-b border-border/40 backdrop-blur shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      onDoubleClick={() => api.maximizeToggle()}
    >
      <div className="flex items-center gap-2 pl-3 pr-4 h-full">
        <img
          src={logoMark}
          alt=""
          width={16}
          height={16}
          className="object-contain opacity-90"
        />
        <span className="text-[11px] font-semibold tracking-[0.18em] text-foreground/85">
          FACE<span className="text-primary">LUME</span>
        </span>
      </div>

      <div
        className="flex items-stretch h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => api.minimize()}
          className="w-[46px] h-full flex items-center justify-center text-foreground/80 hover:bg-foreground/[0.08] active:bg-foreground/[0.12] transition-colors duration-100 outline-none focus-visible:bg-foreground/[0.08]"
          aria-label="Minimize"
          title="Minimize"
        >
          {MinimizeGlyph}
        </button>
        <button
          type="button"
          onClick={() => api.maximizeToggle()}
          className="w-[46px] h-full flex items-center justify-center text-foreground/80 hover:bg-foreground/[0.08] active:bg-foreground/[0.12] transition-colors duration-100 outline-none focus-visible:bg-foreground/[0.08]"
          aria-label={maximized ? "Restore" : "Maximize"}
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? RestoreGlyph : MaximizeGlyph}
        </button>
        <button
          type="button"
          onClick={() => api.close()}
          className="w-[46px] h-full flex items-center justify-center text-foreground/85 hover:bg-[#E81123] hover:text-white active:bg-[#C50F1F] active:text-white transition-colors duration-100 outline-none focus-visible:bg-[#E81123] focus-visible:text-white"
          aria-label="Close"
          title="Close"
        >
          {CloseGlyph}
        </button>
      </div>
    </div>
  );
};
