import { Link } from "react-router-dom";
import logoMark from "@/assets/facelume-mark.png";

export const Logo = () => (
  <Link to="/" className="flex items-center gap-3 group">
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-primary blur-2xl opacity-60 group-hover:opacity-100 transition-opacity rounded-full" />
      <img
        src={logoMark}
        alt="FaceLume logo"
        width={56}
        height={56}
        className="relative w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow-[0_0_16px_hsl(var(--primary)/0.7)] group-hover:scale-105 transition-transform"
      />
    </div>
    <span className="font-display font-black text-2xl md:text-3xl tracking-[0.2em] leading-none">
      FACE<span className="neon-text">LUME</span>
    </span>
  </Link>
);
