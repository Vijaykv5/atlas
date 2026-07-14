import type { CSSProperties } from "react";

type RevealStyle = CSSProperties & {
  "--reveal-delay": string;
};

export const TIMING = {
  heroEyebrow: "120ms",
  heroTitle: "220ms",
  heroCopy: "300ms",
  heroActions: "360ms",
  heroMap: "520ms",
  sectionHeader: "120ms",
  archivePanel: "220ms",
  sidePanel: "340ms",
  ctaPanel: "180ms",
  stepCards: ["120ms", "240ms", "360ms"],
  memoryRows: ["140ms", "220ms", "300ms", "380ms"],
} as const;

export function revealStyle(delay: string): RevealStyle {
  return { "--reveal-delay": delay };
}
