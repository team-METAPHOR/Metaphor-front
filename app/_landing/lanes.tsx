"use client";

import { useEffect, useRef } from "react";

type Kind = "intro" | "hero" | "band" | "final";

type Lane = {
  x: number;
  w: number;
  path: SVGPathElement;
  node: SVGCircleElement | null;
  red: boolean;
  base: number;
  amp: number;
  phase: number;
  speed: number;
  dx: number;
  dy: number;
};

const NS = "http://www.w3.org/2000/svg";

function build(svg: SVGSVGElement, kind: Kind) {
  const W = svg.clientWidth || window.innerWidth;
  const H = svg.clientHeight || window.innerHeight;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const colW = W < 700 ? 44 : 64;
  const count = Math.ceil(W / colW) + 2;
  const first = Math.floor(count * 0.62);
  const redCols = kind === "band" ? [] : [first, first + 2];
  const lanes: Lane[] = [];
  for (let i = 0; i < count; i++) {
    const red = redCols.includes(i);
    const jogged = red || i % 3 === 1;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("fill", red ? "var(--ld-red-lane)" : i % 2 ? "var(--ld-lane-1)" : "var(--ld-lane-2)");
    if (!red) path.setAttribute("opacity", (0.35 + ((i * 37) % 10) / 20).toFixed(2));
    svg.appendChild(path);
    let node: SVGCircleElement | null = null;
    if (jogged) {
      node = document.createElementNS(NS, "circle");
      node.setAttribute("r", red ? "5" : "3.5");
      node.setAttribute("fill", red ? "var(--ld-node)" : "#4A5274");
      svg.appendChild(node);
    }
    lanes.push({
      x: (i - 1) * colW,
      w: colW - 4,
      path,
      node,
      red,
      base: H * (red ? (i === first ? 0.62 : 0.48) : 0.2 + ((i * 53) % 60) / 100),
      amp: red ? H * 0.08 : H * 0.05,
      phase: i * 1.7,
      speed: 0.00018 + (i % 4) * 0.00005,
      dx: jogged ? -(colW * 0.55) : 0,
      dy: colW * 0.7,
    });
  }
  return { lanes, H };
}

function draw({ lanes, H }: ReturnType<typeof build>, t: number, scroll: number) {
  for (const L of lanes) {
    const { x, w, dx, dy } = L;
    if (!L.node) {
      L.path.setAttribute("d", `M${x} 0H${x + w}V${H}H${x}Z`);
      continue;
    }
    const j = L.base + Math.sin(t * L.speed + L.phase) * L.amp - scroll * (L.red ? 80 : 30);
    L.path.setAttribute("d", `M${x} 0H${x + w}V${j}L${x + w + dx} ${j + dy}V${H}H${x + dx}V${j + dy}L${x} ${j}Z`);
    L.node.setAttribute("cx", String(x + dx));
    L.node.setAttribute("cy", String(j + dy));
  }
}

export function Lanes({ kind, className }: { kind: Kind; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroll = () => (kind === "hero" ? window.scrollY / window.innerHeight : 0);
    let set = build(svg, kind);
    draw(set, 0, 0);

    const resize = new ResizeObserver(() => {
      set = build(svg, kind);
      draw(set, performance.now(), scroll());
    });
    resize.observe(svg);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(svg);

    let frame = 0;
    const tick = (t: number) => {
      if (visible) draw(set, t, scroll());
      frame = requestAnimationFrame(tick);
    };
    if (!reduce) frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      io.disconnect();
    };
  }, [kind]);

  return (
    <svg ref={ref} aria-hidden preserveAspectRatio="none" className={`absolute inset-0 block size-full ${className ?? ""}`} />
  );
}
