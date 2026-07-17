import Image from "next/image";
import { TIMING, revealStyle } from "./animation";

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-7xl flex-col items-center justify-center px-5 py-16 text-center md:px-8"
    >
      <div className="hero-glow" aria-hidden="true" />
      <div
        className="reveal reveal-up relative z-10 mb-5 inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.34em] text-[#f4b541]"
        style={revealStyle(TIMING.heroEyebrow)}
      >
        <span className="size-2 rounded-full bg-[#f4b541] shadow-[0_0_18px_rgba(244,181,65,0.9)]" />
        memories on avalanche
      </div>

      <h1
        className="reveal reveal-up relative z-10 max-w-5xl text-balance text-5xl font-semibold leading-[0.95] tracking-normal text-white md:text-7xl lg:text-8xl"
        style={revealStyle(TIMING.heroTitle)}
      >
        Every memory can last
      </h1>
      <p
        className="reveal reveal-up relative z-10 mt-6 max-w-3xl text-pretty text-lg leading-8 text-white/68 md:text-xl"
        style={revealStyle(TIMING.heroCopy)}
      >
        Write the title, country, type, and note, then store the memory directly
        on Avalanche.
      </p>

      <div
        className="reveal reveal-up relative z-10 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        style={revealStyle(TIMING.heroActions)}
      >
        <a
          href="/atlas"
          className="hero-primary-action inline-flex min-h-12 items-center justify-center rounded-full bg-[#f4b541] px-7 text-sm font-extrabold text-black shadow-[0_16px_42px_rgba(244,181,65,0.16)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Explore Atlas
        </a>
        <a
          href="/atlas?mode=create"
          className="hero-secondary-action inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-7 text-sm font-bold text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Create Memory
        </a>
      </div>

      <div
        className="reveal reveal-soft hero-map map-stage relative z-0 mt-12 w-full max-w-5xl"
        style={revealStyle(TIMING.heroMap)}
      >
        <Image
          src="/connect-hero.svg"
          alt="Dotted world map with connected memory points"
          width={984}
          height={344}
          loading="eager"
          className="w-full opacity-90"
        />
        <div className="map-orbit orbit-one" aria-hidden="true" />
        <div className="map-orbit orbit-two" aria-hidden="true" />
        <div className="pin pin-one" aria-hidden="true" />
        <div className="pin pin-two" aria-hidden="true" />
        <div className="pin pin-three" aria-hidden="true" />
        <div className="story-chip story-chip-one" aria-hidden="true">
          memory note saved
        </div>
        <div className="story-chip story-chip-two" aria-hidden="true">
          on-chain story minted
        </div>
        <div className="story-trace story-trace-one" aria-hidden="true" />
        <div className="story-trace story-trace-two" aria-hidden="true" />
      </div>
    </section>
  );
}
