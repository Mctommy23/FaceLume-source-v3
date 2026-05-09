import { useState } from "react";
import { MessageCircle, X, Send, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TELEGRAM_URL = "https://t.me/+2349138849672";
const WHATSAPP_NUMBER = "2349138849672"; // international format, no +

const PRESETS = [
  { label: "Payment issue", text: "Hi, I have a payment issue." },
  { label: "Activation problem", text: "Hi, I have an activation problem." },
  { label: "Credits not updating", text: "Hi, my credits are not updating." },
  { label: "General help", text: "Hi, I need help." },
];

// Note: phone-style t.me links (https://t.me/+number) don't support ?text= prefill
const buildTelegram = (_text: string) => TELEGRAM_URL;
const buildWhatsApp = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export const SupportWidget = () => {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(PRESETS[0].text);

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Contact support"
          className="w-[300px] glass-strong rounded-2xl border border-border/60 shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base leading-none mb-1">Need help?</h3>
              <p className="text-xs text-muted-foreground">We usually reply within minutes.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close support"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Topic
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(p.text)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    preset === p.text
                      ? "bg-primary/20 border-primary/50 text-primary-glow"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href={buildTelegram(preset)} target="_blank" rel="noopener noreferrer">
              <Button variant="glass" size="sm" className="w-full">
                <Send className="w-4 h-4" /> Telegram
              </Button>
            </a>
            <a href={buildWhatsApp(preset)} target="_blank" rel="noopener noreferrer">
              <Button variant="glass" size="sm" className="w-full">
                <Phone className="w-4 h-4" /> WhatsApp
              </Button>
            </a>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support" : "Open support"}
        className="w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground shadow-[0_0_30px_hsl(280_100%_65%/0.5)] hover:shadow-[0_0_50px_hsl(280_100%_65%/0.8)] transition-all hover:-translate-y-0.5 flex items-center justify-center"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default SupportWidget;
