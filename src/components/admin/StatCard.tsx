import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
}) => (
  <div className="relative">
    {accent && (
      <div className="absolute -inset-px bg-gradient-primary opacity-20 blur rounded-2xl pointer-events-none" />
    )}
    <div className="relative glass-strong rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className={`font-display font-black text-2xl md:text-3xl ${accent ? "neon-text" : ""}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </div>
  </div>
);
