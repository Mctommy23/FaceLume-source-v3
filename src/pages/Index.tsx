import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Demo } from "@/components/landing/Demo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { UseCases } from "@/components/landing/UseCases";
import { Pricing } from "@/components/landing/Pricing";
import { DownloadSection } from "@/components/landing/DownloadSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/Footer";
import { SupportWidget } from "@/components/SupportWidget";

const Index = () => {
  return (
    <>
      {/* SEO */}
      <title>FaceLume — Become Any Character in Real-Time</title>
      <meta name="description" content="FaceLume transforms your live camera into any identity using real-time AI. Built for gamers, streamers, and creators." />
      <link rel="canonical" href="/" />

      <div className="min-h-screen">
        <Navbar />
        <main>
          <h1 className="sr-only">FaceLume — Real-time AI face transformation for streamers</h1>
          <Hero />
          <Demo />
          <HowItWorks />
          <Features />
          <UseCases />
          <Pricing />
          <DownloadSection />
          <FinalCTA />
        </main>
        <Footer />
        <SupportWidget />
      </div>
    </>
  );
};

export default Index;
