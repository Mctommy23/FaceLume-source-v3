import { ArrowRight } from "lucide-react";
import inputImg from "@/assets/demo-input.jpg";
import outputImg from "@/assets/demo-output.jpg";

export const Demo = () => {
  return (
    <section id="demo" className="py-24 relative">
      <div className="container">
        <div className="text-center mb-14 animate-fade-in">
          <p className="text-sm font-mono uppercase tracking-[0.3em] text-accent mb-4">// Live demo</p>
          <h2 className="font-display font-bold text-4xl md:text-6xl mb-4">
            Real-time AI <span className="neon-text">at 720p</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Sub-100ms latency. No green screen, no makeup, no cosplay required.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-center max-w-5xl mx-auto">
          <DemoCard label="You" sublabel="Webcam Input" image={inputImg} alt="Your real face captured by webcam" tone="cyan" />
          <div className="flex md:flex-col items-center justify-center gap-3 py-4">
            <div className="h-px md:h-16 w-16 md:w-px bg-gradient-to-r md:bg-gradient-to-b from-secondary to-primary" />
            <div className="p-3 rounded-full bg-gradient-primary glow-primary">
              <ArrowRight className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="h-px md:h-16 w-16 md:w-px bg-gradient-to-r md:bg-gradient-to-b from-primary to-secondary" />
          </div>
          <DemoCard label="Character" sublabel="AI Output · Live" image={outputImg} alt="AI-transformed cyberpunk character output" tone="purple" />
        </div>
      </div>
    </section>
  );
};

const DemoCard = ({ label, sublabel, image, alt, tone }: { label: string; sublabel: string; image: string; alt: string; tone: "cyan" | "purple" }) => (
  <div className={`relative group ${tone === "purple" ? "animate-pulse-glow" : ""} rounded-2xl`}>
    <div className={`absolute -inset-1 rounded-2xl opacity-50 blur-xl ${tone === "cyan" ? "bg-secondary/50" : "bg-primary/60"}`} />
    <div className="relative glass-strong rounded-2xl p-3 overflow-hidden">
      <div className="rounded-xl overflow-hidden aspect-square relative">
        <img src={image} alt={alt} loading="lazy" width={768} height={768} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-lg">{label}</div>
            <div className="text-xs text-muted-foreground font-mono">{sublabel}</div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md glass text-[10px] font-mono uppercase tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${tone === "cyan" ? "bg-secondary" : "bg-primary"} animate-pulse`} />
            720p
          </div>
        </div>
      </div>
    </div>
  </div>
);
