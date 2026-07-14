import Image from "next/image";
import { TIMING, revealStyle } from "./animation";
import { memories } from "./data";

export function ArchiveSection() {
  return (
    <section
      id="archive"
      className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-16"
    >
      <div
        className="reveal reveal-left map-panel"
        style={revealStyle(TIMING.archivePanel)}
      >
        <div>
          <p className="section-kicker">Global archive</p>
          <h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
            Explore human moments by place, time, and feeling.
          </h2>
        </div>
        <div className="archive-map-frame relative mt-12 overflow-hidden rounded-[28px] border border-white/10 bg-[#080808] p-5 md:p-8">
          <Image
            src="/connect-hero.svg"
            alt=""
            width={984}
            height={344}
            className="w-full opacity-45 saturate-150"
          />
          <div className="memory-card left-[9%] top-[18%]">
            <span>Voice note</span>
            sunrise in lima
          </div>
          <div className="memory-card bottom-[14%] right-[10%]">
            <span>Photo story</span>
            lantern night
          </div>
        </div>
      </div>

      <aside
        className="reveal reveal-right story-panel"
        style={revealStyle(TIMING.sidePanel)}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f4b541]">
          Live pins
        </p>
        <div className="mt-8 space-y-4">
          {memories.map((memory, index) => (
            <div
              key={memory}
              className="reveal reveal-up memory-row"
              style={revealStyle(TIMING.memoryRows[index])}
            >
              <span aria-hidden="true" />
              <p>{memory}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3">
          <div className="stat-box">
            <strong>24k</strong>
            <span>stories mapped</span>
          </div>
          <div className="stat-box">
            <strong>189</strong>
            <span>countries</span>
          </div>
        </div>
      </aside>
    </section>
  );
}
