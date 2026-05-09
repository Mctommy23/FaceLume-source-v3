import { Logo } from "./Logo";

export const Footer = () => (
  <footer className="border-t border-border/40 py-10 mt-12">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Logo />
        <span className="text-xs text-muted-foreground hidden md:inline">· Illuminate Your Identity</span>
      </div>
      <div className="text-xs text-muted-foreground font-mono">
        © {new Date().getFullYear()} FACELUME · ALL SYSTEMS NOMINAL
      </div>
    </div>
  </footer>
);
