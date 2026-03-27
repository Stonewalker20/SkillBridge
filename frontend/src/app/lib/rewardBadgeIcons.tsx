import type { SVGProps } from "react";
import { cn } from "../components/ui/utils";

function BadgeSpark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <rect x="8" y="8" width="32" height="32" rx="12" fill="currentColor" opacity="0.16" />
      <path d="M24 12l2.7 7.3L34 22l-7.3 2.7L24 32l-2.7-7.3L14 22l7.3-2.7L24 12z" fill="currentColor" />
      <circle cx="34.5" cy="13.5" r="2.5" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function BadgeStack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path d="M10 19.5L24 11l14 8.5L24 28 10 19.5z" fill="currentColor" opacity="0.95" />
      <path d="M13 25l11 6.5L35 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d="M13 30.5L24 37l11-6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
    </svg>
  );
}

function BadgeShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path d="M24 10l12 4.5v9.8c0 8.1-5 12.8-12 15.7-7-2.9-12-7.6-12-15.7v-9.8L24 10z" fill="currentColor" opacity="0.92" />
      <path d="M18.5 24.5l4 4 7-8" stroke="white" strokeWidth="3.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BadgeLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path d="M24 10l14 8-14 8-14-8 14-8z" fill="currentColor" opacity="0.95" />
      <path d="M13 23.5l11 6.5 11-6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <path d="M16 29l8 4.5 8-4.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function BadgeScroll(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path d="M16 12h14c4.4 0 8 3.6 8 8v12c0 2.2-1.8 4-4 4H20c-5.5 0-10-4.5-10-10v-6c0-4.4 3.6-8 8-8z" fill="currentColor" opacity="0.9" />
      <path d="M18 19h12M18 24h10M18 29h8" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.95" />
      <path d="M12 15c0 2.2 1.8 4 4 4h2v-8h-2c-2.2 0-4 1.8-4 4z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function BadgeCompass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <circle cx="24" cy="24" r="13.5" stroke="currentColor" strokeWidth="4" opacity="0.9" />
      <path d="M28.8 19.2l-3.4 8.3-8.2 3.3 3.3-8.2 8.3-3.4z" fill="currentColor" />
      <circle cx="24" cy="24" r="2.5" fill="white" />
    </svg>
  );
}

function BadgeRocket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path d="M30.5 11.5c-7.8 1.3-13.7 7.2-15 15l6 6c7.8-1.3 13.7-7.2 15-15l-6-6z" fill="currentColor" opacity="0.92" />
      <path d="M18 30l-4 8 8-4" fill="currentColor" opacity="0.65" />
      <circle cx="27.5" cy="20.5" r="2.6" fill="white" />
      <path d="M16 23l9 9" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function BadgeRibbon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <circle cx="24" cy="20" r="9" fill="currentColor" opacity="0.95" />
      <path d="M18.5 27.5L16 39l8-4.5 8 4.5-2.5-11.5" fill="currentColor" opacity="0.72" />
      <path d="M20.2 20.5l2.2 2.2 5.4-5.4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const BADGE_ART: Record<string, { Svg: (props: SVGProps<SVGSVGElement>) => JSX.Element; frameClassName: string; artClassName: string }> = {
  award: {
    Svg: BadgeRibbon,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(59,130,246,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(59,130,246,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-blue-600 dark:text-blue-300",
  },
  spark: {
    Svg: BadgeSpark,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(14,165,233,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(14,165,233,0.2),_rgba(15,23,42,0.96))]",
    artClassName: "text-sky-600 dark:text-sky-300",
  },
  stack: {
    Svg: BadgeStack,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(20,184,166,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(20,184,166,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-teal-600 dark:text-teal-300",
  },
  shield: {
    Svg: BadgeShield,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(99,102,241,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(99,102,241,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-indigo-600 dark:text-indigo-300",
  },
  layers: {
    Svg: BadgeLayers,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(139,92,246,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(139,92,246,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-violet-600 dark:text-violet-300",
  },
  scroll: {
    Svg: BadgeScroll,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(245,158,11,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(245,158,11,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-amber-600 dark:text-amber-300",
  },
  compass: {
    Svg: BadgeCompass,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(37,99,235,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(37,99,235,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-blue-600 dark:text-blue-300",
  },
  rocket: {
    Svg: BadgeRocket,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(236,72,153,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(236,72,153,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-pink-600 dark:text-pink-300",
  },
  badge: {
    Svg: BadgeRibbon,
    frameClassName: "bg-[linear-gradient(135deg,_rgba(34,197,94,0.14),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(34,197,94,0.18),_rgba(15,23,42,0.96))]",
    artClassName: "text-emerald-600 dark:text-emerald-300",
  },
};

export function RewardBadgeIcon({
  iconKey,
  className,
}: {
  iconKey?: string | null;
  className?: string;
}) {
  const art = BADGE_ART[String(iconKey ?? "award").trim()] ?? BADGE_ART.award;
  const Svg = art.Svg;
  return (
    <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", art.frameClassName, className)}>
      <Svg className={cn("h-8 w-8", art.artClassName)} />
    </div>
  );
}
