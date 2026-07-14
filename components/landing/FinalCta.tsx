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
            Enter the memory globe.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/64">
            Discover real stories from real places, then leave your own mark on
            the map.
          </p>
          <button className="launch-button mt-9 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-extrabold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black">
            Launch Globe
          </button>
        </div>
      </div>
    </section>
  );
}
