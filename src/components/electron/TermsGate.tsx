import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "facelume:terms-accepted-v1";

export const hasAcceptedTerms = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const TermsGate = ({ onAccept }: { onAccept: () => void }) => {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.clientHeight <= 8 || el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
      setScrolledToEnd(true);
    }
  };

  useEffect(() => {
    // If content fits without scrolling, mark as scrolled to end immediately
    const t = setTimeout(checkScroll, 100);
    return () => clearTimeout(t);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.setItem(`${STORAGE_KEY}:at`, new Date().toISOString());
    } catch {
      /* ignore */
    }
    onAccept();
  };

  const decline = () => {
    // In Electron, attempt to close the window. In browser, navigate away.
    try {
      window.close();
    } catch {
      /* ignore */
    }
    // Fallback: blank the page
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border">
          <h1 className="font-display text-2xl font-black tracking-wide">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please read and accept before using FaceLume.
          </p>
        </div>

        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="absolute inset-0 overflow-y-auto px-6 py-4 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
          >
          <div className="prose prose-invert text-sm space-y-3 text-foreground/90 max-w-none">
            <p>
              <strong>1. Acceptance.</strong> By installing or using FaceLume
              ("the App"), you agree to be bound by these Terms &amp;
              Conditions. If you do not agree, do not use the App.
            </p>
            <p>
              <strong>2. License.</strong> FaceLume grants you a limited,
              non-exclusive, non-transferable license to use the App for
              personal or commercial streaming purposes, subject to your
              available credits and active subscription status.
            </p>
            <p>
              <strong>3. Acceptable Use.</strong> You agree not to use the App
              to create, transmit, or stream content that is unlawful,
              harassing, defamatory, infringing, sexually explicit involving
              minors, or that impersonates another real person without consent.
              You are solely responsible for the content you produce.
            </p>
            <p>
              <strong>4. Identity &amp; Likeness.</strong> Real-time face and
              voice transformation tools must not be used to deceive, defraud,
              or impersonate individuals in a manner that could cause harm.
              You represent that you have the rights to any likeness you
              transform or broadcast.
            </p>
            <p>
              <strong>5. Credits &amp; Billing.</strong> Streaming consumes
              credits at the rates displayed in-app. Credits are
              non-refundable except where required by law. Streams will stop
              automatically when your balance reaches zero.
            </p>
            <p>
              <strong>6. Privacy.</strong> The App captures camera and
              microphone input only while a stream is active and processes it
              through our streaming partners to deliver the transformation.
              See our Privacy Policy for details.
            </p>
            <p>
              <strong>7. Availability.</strong> The App relies on third-party
              streaming infrastructure. We do not guarantee uninterrupted
              service and are not liable for loss caused by outages.
            </p>
            <p>
              <strong>8. Disclaimer.</strong> THE APP IS PROVIDED "AS IS"
              WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY
              LAW, WE DISCLAIM ALL IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              <strong>9. Limitation of Liability.</strong> In no event shall
              FaceLume's total liability exceed the amount you paid for
              credits in the 30 days preceding the claim.
            </p>
            <p>
              <strong>10. Termination.</strong> We may suspend or terminate
              your access for breach of these Terms. You may stop using the
              App at any time.
            </p>
            <p>
              <strong>11. Changes.</strong> We may update these Terms. Continued
              use after changes constitutes acceptance of the revised Terms.
            </p>
            <p className="text-muted-foreground">
              Last updated: May 2026.
            </p>
          </div>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent" />
          {!scrolledToEnd && (
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollBy({ top: 240, behavior: "smooth" })}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-medium backdrop-blur-sm transition-all animate-bounce shadow-lg"
              aria-label="Scroll down"
            >
              <span>Scroll</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(Boolean(v))}
              className="mt-0.5"
            />
            <span className="text-sm">
              I have read and agree to the Terms &amp; Conditions.
            </span>
          </label>
          {!scrolledToEnd && (
            <p className="text-xs text-muted-foreground">
              Scroll to the end of the terms to confirm you have read them.
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={decline}>
              Decline &amp; Exit
            </Button>
            <Button
              onClick={accept}
              disabled={!agreed || !scrolledToEnd}
              className="min-w-32"
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
