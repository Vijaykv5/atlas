import { TIMING, revealStyle } from "./animation";
import { steps } from "./data";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8 md:py-28"
    >
      <div
        className="reveal reveal-up mb-12 max-w-4xl"
        style={revealStyle(TIMING.sectionHeader)}
      >
        <p className="section-kicker">How it works</p>
        <h2 className="mt-5 text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
          Turn a moment into an on-chain memory.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <article
            key={step.label}
            className="reveal reveal-up step-card"
            style={revealStyle(TIMING.stepCards[index])}
          >
            <span className="step-number">0{index + 1}</span>
            <h3>{step.label}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
