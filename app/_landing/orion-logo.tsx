"use client";

import { useId, useRef, type Ref } from "react";

const VIEWBOX = "300 735 1332 460";
const RINGS = [
  [466, 1036],
  [1138, 1036],
] as const;
const STEMS = [
  [673, 905],
  [874, 905],
  [1346, 905],
] as const;
const R_ARM = "M730 921C760 901 798 892 832 892V948C765 948 730 972 730 1045Z";
const N_ARCH =
  "M1403 913C1428 898 1455 892 1479 892C1555 892 1612 945 1612 1030V1166H1556V1030C1556 976 1526 948 1479 948C1432 948 1403 977 1403 1030Z";
const R_ARM_PEN = "M701 1050C701 958 750 920 832 920";
const N_ARCH_PEN = "M1374 1040C1374 962 1418 920 1479 920C1541 920 1584 962 1584 1030V1170";
const BELT = [
  [854, 822, 22],
  [902, 795, 26],
  [950, 769, 22],
] as const;

function Shapes({ paint, id, className }: { paint: string; id: string; className?: string }) {
  return (
    <g className={className}>
      {RINGS.map(([x, y], i) => (
        <circle
          key={i}
          className="ld-ring"
          cx={x}
          cy={y}
          r={117.5}
          fill="none"
          stroke={paint}
          strokeWidth={57}
          pathLength={1}
        />
      ))}
      {STEMS.map(([x, y], i) => (
        <rect key={i} className="ld-stem" data-stem={i} x={x} y={y} width={57} height={261} fill={paint} />
      ))}
      <path d={R_ARM} fill={paint} mask={`url(#${id}-arm)`} />
      <path d={N_ARCH} fill={paint} mask={`url(#${id}-arch)`} />
    </g>
  );
}

export function OrionLogo({ className, label, ref }: { className?: string; label?: string; ref?: Ref<SVGSVGElement> }) {
  const id = "orion" + useId().replace(/[^\w-]/g, "");
  return (
    <svg
      ref={ref}
      viewBox={VIEWBOX}
      className={`block h-full w-auto overflow-visible ${className ?? ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-metal`} gradientUnits="userSpaceOnUse" x1="0" y1="880" x2="0" y2="1190">
          <stop offset="0" stopColor="#F3F5F9" />
          <stop offset=".55" stopColor="#D3D8E2" />
          <stop offset="1" stopColor="#A9B1C1" />
        </linearGradient>
        <linearGradient
          id={`${id}-sheen`}
          data-sheen
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="735"
          x2="260"
          y2="1195"
          gradientTransform="translate(-700 0)"
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-arm`} maskUnits="userSpaceOnUse" x="300" y="735" width="1332" height="460">
          <path className="ld-pen" data-pen="arm" d={R_ARM_PEN} fill="none" stroke="#fff" strokeWidth={80} pathLength={1} />
        </mask>
        <mask id={`${id}-arch`} maskUnits="userSpaceOnUse" x="300" y="735" width="1332" height="460">
          <path className="ld-pen" data-pen="arch" d={N_ARCH_PEN} fill="none" stroke="#fff" strokeWidth={80} pathLength={1} />
        </mask>
      </defs>
      <Shapes paint={`url(#${id}-metal)`} id={id} />
      <Shapes paint={`url(#${id}-sheen)`} id={id} className="mix-blend-screen" />
      {BELT.map(([x, y, r], i) => (
        <circle key={i} className="ld-star" cx={x} cy={y} r={r} fill="var(--ld-red)" />
      ))}
    </svg>
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function sweep(svg: SVGSVGElement, duration = 900, delay = 0) {
  const gradient = svg.querySelector("[data-sheen]");
  if (!gradient || reducedMotion()) return;
  const start = performance.now() + delay;
  const step = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = 1 - Math.pow(1 - k, 3);
    gradient.setAttribute("gradientTransform", `translate(${-700 + eased * 2300} 0)`);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function hop(svg: SVGSVGElement) {
  if (reducedMotion()) return;
  svg.querySelectorAll<SVGCircleElement>(".ld-star").forEach((star, i) => {
    star.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-46px) scale(1.15)" }, { transform: "translateY(0)" }],
      { duration: 520, delay: i * 90, easing: "cubic-bezier(.3,.7,.4,1)" },
    );
  });
  sweep(svg, 800, 120);
}

export function HoverLogo({ className, label }: { className?: string; label?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  return (
    <span className={`block ${className ?? ""}`} onMouseEnter={() => ref.current && hop(ref.current)}>
      <OrionLogo ref={ref} label={label} />
    </span>
  );
}
