import Image from "next/image";
import { TIMING, revealStyle } from "./animation";

export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <div
        className="reveal reveal-soft cta-panel"
        style={revealStyle(TIMING.ctaPanel)}
      >
        <Image
          src="/connect-hero.svg"
          alt=""
          width={984}
          height={344}
          className="cta-map"
        />
        <span className="cta-signal cta-signal-one" aria-hidden="true" />
        <span className="cta-signal cta-signal-two" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <h2 className="cta-title text-balance font-semibold text-white">
            Enter the memory globe
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/64">
            Explore memories from real places, or turn your own moment into an
            on-chain Atlas pin.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/atlas"
              className="launch-button mt-0 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-extrabold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Explore Globe
            </a>
            <a
              href="/atlas?mode=create"
              className="hero-secondary-action inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 text-sm font-bold text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Create Memory
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
