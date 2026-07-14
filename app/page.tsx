import { ArchiveSection } from "@/components/landing/ArchiveSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Navbar } from "@/components/landing/Navbar";

/* ─────────────────────────────────────────────────────────
 * LANDING PAGE STORYBOARD
 *
 * Static shell stays interactive immediately.
 * CSS handles the light entrance choreography and reduced motion.
 *
 *    0ms   navbar is visible and usable
 *  120ms   hero eyebrow fades in + settles
 *  220ms   headline and copy rise into place
 *  360ms   actions appear
 *  520ms   globe map floats in with pins already usable as visuals
 *  640ms   feature cards and archive panels softly cascade
 * ───────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <Navbar />
      <HeroSection />
      <HowItWorks />
      <ArchiveSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
