"use client";

import { useEffect, useRef, useState } from "react";
import { Lanes } from "./lanes";
import { OrionLogo, sweep } from "./orion-logo";

export const NAV_LOGO_ID = "orion-nav-logo";
const READY_EVENT = "orion:ready";

export function onLandingReady(callback: () => void): () => void {
  if (document.documentElement.dataset.orionReady) {
    callback();
    return () => {};
  }
  window.addEventListener(READY_EVENT, callback, { once: true });
  return () => window.removeEventListener(READY_EVENT, callback);
}

function markReady() {
  document.documentElement.dataset.orionReady = "1";
  window.dispatchEvent(new Event(READY_EVENT));
}

export function Intro() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const finishNow = () => {
      markReady();
      setDone(true);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current || !box.current || !svg.current) {
      finishNow();
      return () => delete html.dataset.orionReady;
    }
    const overlay = root.current;
    const logoBox = box.current;
    const logo = svg.current;
    const navLogo = document.getElementById(NAV_LOGO_ID);
    document.body.style.overflow = "hidden";
    if (navLogo) navLogo.style.visibility = "hidden";

    const anims: Animation[] = [];
    const out = "cubic-bezier(.16,1,.3,1)";
    const play = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      anims.push(el.animate(frames, { fill: "both", ...options }));
    };

    logo.querySelectorAll<SVGRectElement>(".ld-stem").forEach((el) => {
      const i = Number(el.dataset.stem);
      play(
        el,
        [
          { transform: "translateY(-900px) scaleY(2.4)", opacity: 0 },
          { opacity: 1, offset: 0.3 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 760, delay: 80 + i * 110, easing: out },
      );
    });
    logo.querySelectorAll<SVGCircleElement>(".ld-ring").forEach((el, i) => {
      el.style.strokeDasharray = "1";
      play(
        el,
        [
          { strokeDashoffset: 1, transform: "rotate(-120deg)" },
          { strokeDashoffset: 0, transform: "rotate(-90deg)" },
        ],
        { duration: 900, delay: 260 + (i % 2) * 140, easing: out },
      );
    });
    logo.querySelectorAll<SVGPathElement>(".ld-pen").forEach((el) => {
      const arm = el.dataset.pen === "arm";
      el.style.strokeDasharray = "1";
      play(el, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: arm ? 520 : 820,
        delay: arm ? 640 : 840,
        easing: "cubic-bezier(.65,0,.35,1)",
      });
    });
    logo.querySelectorAll<SVGCircleElement>(".ld-star").forEach((el, i) => {
      play(
        el,
        [
          { transform: "translate(-520px, 300px) scale(.4)", opacity: 0 },
          { transform: "translate(-120px, 70px) scale(1)", opacity: 1, offset: 0.6 },
          { transform: "translate(12px, -7px) scale(1.25)", offset: 0.85 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 820, delay: 1150 + i * 110, easing: "cubic-bezier(.3,.6,.3,1)" },
      );
    });
    sweep(logo, 900, 1900);

    let docking = false;
    let finishTimer = 0;
    const finish = () => {
      document.body.style.overflow = "";
      if (navLogo) navLogo.style.visibility = "";
      finishNow();
    };
    const dock = () => {
      if (docking) return;
      docking = true;
      anims.forEach((a) => a.finish());
      const from = logoBox.getBoundingClientRect();
      const to = navLogo?.getBoundingClientRect() ?? from;
      const scale = to.height / from.height;
      logoBox.animate(
        [{ transform: "none" }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})` }],
        { duration: 700, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" },
      );
      overlay.animate([{ backgroundColor: "rgb(255 255 255 / 1)" }, { backgroundColor: "rgb(255 255 255 / 0)" }], {
        duration: 700,
        delay: 150,
        fill: "forwards",
      });
      overlay.querySelectorAll("svg[aria-hidden], button").forEach((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }),
      );
      finishTimer = window.setTimeout(finish, 720);
    };
    const autoTimer = window.setTimeout(dock, 2900);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") dock();
    };
    overlay.addEventListener("click", dock);
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(autoTimer);
      window.clearTimeout(finishTimer);
      overlay.removeEventListener("click", dock);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (navLogo) navLogo.style.visibility = "";
      delete html.dataset.orionReady;
    };
  }, []);

  if (done) return null;
  return (
    <div ref={root} className="ld-intro fixed inset-0 z-50 grid cursor-pointer place-items-center bg-(--ld-bg)">
      <Lanes kind="intro" className="opacity-55" />
      <div ref={box} className="relative w-[min(72vw,640px)] origin-top-left [&_svg]:h-auto [&_svg]:w-full">
        <OrionLogo ref={svg} />
      </div>
      <button
        type="button"
        className="absolute right-6 bottom-6 rounded-full border border-(--ld-border-strong) px-3 py-2 font-mono text-xs text-(--ld-text-3)"
      >
        건너뛰기
      </button>
    </div>
  );
}
