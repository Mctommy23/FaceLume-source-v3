import { Twitch, Youtube, Video, Gamepad2, EyeOff } from "lucide-react";

const cases = [
  { icon: Twitch, title: "Twitch Streaming", desc: "Stand out in a sea of streamers." },
  { icon: Youtube, title: "YouTube Live", desc: "Bring characters to your live shows." },
  { icon: Video, title: "Virtual Meetings", desc: "Spice up your Zoom — or stay anonymous." },
  { icon: Gamepad2, title: "Gaming Identity", desc: "Switch persona per game, per session." },
  { icon: EyeOff, title: "Anonymous Streaming", desc: "Protect your privacy without losing presence." },
];

export const UseCases = () => {
  return (
    <section id="use-cases" className="py-24 relative">
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-sm font-mono uppercase tracking-[0.3em] text-accent mb-4">// Use cases</p>
          <h2 className="font-display font-bold text-4xl md:text-6xl">
            Wherever you go <span className="neon-text">live</span>
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {cases.map((c) => (
            <div
              key={c.title}
              className="group glass rounded-xl p-5 flex items-center gap-4 min-w-[260px] flex-1 max-w-sm hover:border-secondary/50 transition-all hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-lg bg-secondary/10 border border-secondary/30 flex items-center justify-center group-hover:bg-secondary/20 group-hover:shadow-[0_0_20px_hsl(195_100%_55%/0.4)] transition-all">
                <c.icon className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <div className="font-display font-bold">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
