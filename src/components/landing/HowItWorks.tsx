import { Upload, Camera, Wand2 } from "lucide-react";

const steps = [
  { icon: Upload, title: "Upload Reference", desc: "Drop in any image or pick from our character library." },
  { icon: Camera, title: "Start Your Camera", desc: "Connect your webcam — or your favorite virtual cam." },
  { icon: Wand2, title: "Transform Instantly", desc: "Our AI maps your expressions in real-time. Stream away." },
];

export const HowItWorks = () => {
  return (
    <section id="how" className="py-24 relative">
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-sm font-mono uppercase tracking-[0.3em] text-accent mb-4">// Workflow</p>
          <h2 className="font-display font-bold text-4xl md:text-6xl">
            Three steps to <span className="neon-text">a new identity</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {steps.map((step, i) => (
            <div key={step.title} className="relative glass rounded-2xl p-8 text-center hover:border-primary/40 transition-all hover:-translate-y-1">
              <div className="relative inline-flex mb-6">
                <div className="absolute inset-0 bg-gradient-primary blur-xl opacity-60" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center">
                  <step.icon className="w-9 h-9 text-primary-foreground" />
                </div>
              </div>
              <div className="font-mono text-xs text-accent mb-2">STEP 0{i + 1}</div>
              <h3 className="font-display font-bold text-2xl mb-3">{step.title}</h3>
              <p className="text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
