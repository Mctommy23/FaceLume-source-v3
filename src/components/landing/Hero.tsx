import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Play, Zap } from "lucide-react";
import heroImg from "@/assets/hero-transform.jpg";

export const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-gradient-radial" />
      <div className="absolute top-1/3 -left-32 w-96 h-96 bg-primary/30 rounded-full blur-[120px]" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-secondary/30 rounded-full blur-[120px]" />

      <div className="container relative">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
              Live AI · Real-Time Streaming
            </span>
          </div>

          <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-6 text-balance">
            Become Any <br />
            <span className="neon-text">Character</span> in <br className="md:hidden" />
            Real-Time
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
            FaceLume transforms your live camera feed into any identity using AI.
            Built for gamers, streamers, and creators who want to illuminate their identity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/get-started">
              <Button variant="hero" size="xl" className="group">
                <Zap className="group-hover:rotate-12 transition-transform" />
                Start Streaming
              </Button>
            </Link>
            <a href="#demo">
              <Button variant="glass" size="xl">
                <Play /> Try Demo
              </Button>
            </a>
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative mt-20 max-w-5xl mx-auto animate-scale-in">
          <div className="absolute -inset-4 bg-gradient-primary opacity-30 blur-3xl rounded-3xl" />
          <div className="relative glass-strong rounded-2xl p-2 overflow-hidden">
            <div className="relative rounded-xl overflow-hidden aspect-[3/2]">
              <img
                src={heroImg}
                alt="FaceLume real-time AI face transformation showing input camera and AI output"
                className="w-full h-full object-cover"
                width={1536}
                height={1024}
              />
              {/* Center divider */}
              <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-primary to-transparent shadow-[0_0_20px_hsl(var(--primary))]" />
              <div className="absolute top-4 left-4 px-3 py-1 rounded-md glass text-xs font-mono uppercase tracking-wider">
                <span className="text-accent">●</span> Input
              </div>
              <div className="absolute top-4 right-4 px-3 py-1 rounded-md glass text-xs font-mono uppercase tracking-wider">
                <span className="text-primary-glow">●</span> AI Output
              </div>
              {/* Scan effect */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-scan-line" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
