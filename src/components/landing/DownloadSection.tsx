import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Download, Monitor, Shield, Zap, HelpCircle } from "lucide-react";

const DOWNLOAD_URL =
  "https://lmtwcggtibohzyxhcpiy.supabase.co/storage/v1/object/public/downloads/FaceLume-Windows-1.0.1.zip";

export const DownloadSection = () => {
  return (
    <section id="download" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px]" />

      <div className="container relative">
        <div className="max-w-4xl mx-auto">
          <div className="glass-strong rounded-3xl p-10 md:p-14 text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6">
              <Monitor className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
                Desktop App · Windows
              </span>
            </div>

            <h2 className="font-display font-black text-4xl md:text-6xl leading-tight mb-4 text-balance">
              Get <span className="neon-text">FaceLume</span> on Your Desktop
            </h2>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
              Install the native Windows app for the smoothest streaming
              performance, lower latency, and seamless camera integration.
            </p>

            <a href={DOWNLOAD_URL} download>
              <Button variant="hero" size="xl" className="group">
                <Download className="group-hover:translate-y-0.5 transition-transform" />
                Download for Windows
              </Button>
            </a>

            <p className="text-xs text-muted-foreground mt-4 font-mono">
              FaceLume-Windows-1.0.1.zip · Windows 10 / 11 (64-bit)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 text-left">
              <div className="glass rounded-xl p-5">
                <Zap className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-semibold mb-1">Native Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Optimized for low-latency real-time streaming.
                </p>
              </div>
              <div className="glass rounded-xl p-5">
                <Shield className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-semibold mb-1">Secure Installer</h3>
                <p className="text-sm text-muted-foreground">
                  Standard NSIS installer with uninstall support.
                </p>
              </div>
              <div className="glass rounded-xl p-5">
                <Monitor className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-semibold mb-1">System Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Start menu shortcut and desktop icon included.
                </p>
              </div>
            </div>

            <div className="mt-14 text-left border-t border-white/10 pt-10">
              <div className="flex items-center gap-2 mb-6">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-xl">Frequently Asked Questions</h3>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-3">
                <AccordionItem value="requirements" className="glass rounded-xl border-0 px-5">
                  <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
                    What are the system requirements?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    Windows 10 or 11 (64-bit), 8 GB RAM, a dedicated GPU with 4 GB VRAM, and a stable internet connection. A modern multi-core CPU is recommended for the smoothest real-time streaming experience.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="install" className="glass rounded-xl border-0 px-5">
                  <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
                    How do I install FaceLume?
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    Extract the downloaded <code className="text-primary font-mono">FaceLume-Windows-1.0.1.zip</code> file, then open <code className="text-primary font-mono">FaceLume.exe</code> inside the extracted folder.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="troubleshoot" className="glass rounded-xl border-0 px-5">
                  <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
                    Troubleshooting tips
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    If the app won't launch, make sure Windows is fully updated and your GPU drivers are current. If the camera isn't detected, close other apps using the webcam and restart FaceLume. For streaming lag, lower the output resolution in settings or close background applications.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
