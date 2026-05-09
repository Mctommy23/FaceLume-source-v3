import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";

export const FinalCTA = () => {
  return (
    <section className="py-24 relative">
      <div className="container">
        <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden glass-strong p-12 md:p-20 text-center">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-primary opacity-20 blur-3xl rounded-full" />

          <div className="relative">
            <h2 className="font-display font-black text-4xl md:text-6xl mb-6 text-balance">
              Start Transforming <br /> Your <span className="neon-text">Identity</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
              Illuminate your stream. Become legend. Free forever to start.
            </p>
            <Link to="/get-started">
              <Button variant="hero" size="xl" className="group">
                <Rocket className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
