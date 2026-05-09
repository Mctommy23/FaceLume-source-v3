import { Zap, Video, UserCircle, Cast, Gauge } from "lucide-react";

const features = [
  { icon: Zap, title: "Real-time AI", desc: "Frame-by-frame neural face transformation with sub-100ms latency.", color: "from-primary to-primary-glow" },
  { icon: Video, title: "720p Live Output", desc: "Crystal-clear HD streaming optimized for modern bitrates.", color: "from-secondary to-accent" },
  { icon: UserCircle, title: "Character System", desc: "Upload references, build a library, swap identities mid-stream.", color: "from-accent to-primary" },
  { icon: Cast, title: "OBS & Streamlabs", desc: "Plug in as a virtual camera. Works everywhere your stream goes.", color: "from-primary to-secondary" },
  { icon: Gauge, title: "Low Latency", desc: "Optimized GPU pipeline keeps your reactions perfectly in sync.", color: "from-secondary to-primary" },
];

export const Features = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -translate-y-1/2" />
      <div className="container relative">
        <div className="text-center mb-16">
          <p className="text-sm font-mono uppercase tracking-[0.3em] text-accent mb-4">// Features</p>
          <h2 className="font-display font-bold text-4xl md:text-6xl">
            Built for <span className="neon-text">streamers</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative glass rounded-2xl p-7 hover:border-primary/40 transition-all hover:-translate-y-1 overflow-hidden"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-30 blur-3xl transition-opacity`} />
              <div className={`relative inline-flex w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} items-center justify-center mb-5 shadow-lg`}>
                <f.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
