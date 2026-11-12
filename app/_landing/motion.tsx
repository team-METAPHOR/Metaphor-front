"use client";

import {
  ArrowCounterClockwiseIcon,
  BrowserIcon,
  BrowsersIcon,
  BugIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  FileTextIcon,
  ListIcon,
  SealCheckIcon,
  SparkleIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NAV_LOGO_ID, onLandingReady } from "./intro";
import { OrionLogo, hop } from "./orion-logo";
import { btnGhost, btnPrimary } from "./styles";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useOnceInView<T extends Element>(callback: (instant: boolean) => void | (() => void)) {
  const ref = useRef<T>(null);
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      const cleanup = saved.current(true);
      return cleanup || undefined;
    }
    let cleanup: void | (() => void);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        cleanup = saved.current(false);
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (cleanup) cleanup();
    };
  }, []);
  return ref;
}

export function Reveal({ className, delay, children }: { className?: string; delay?: number; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  const ref = useOnceInView<HTMLDivElement>(() => setShown(true));
  return (
    <div
      ref={ref}
      className={`ld-reveal ${shown ? "is-in" : ""} ${className ?? ""}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

export function InViewClass({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  const [on, setOn] = useState(false);
  const ref = useOnceInView<HTMLDivElement>(() => setOn(true));
  return (
    <div ref={ref} aria-label={label} className={`${className ?? ""} ${on ? "is-on" : ""}`}>
      {children}
    </div>
  );
}


const NAV = [
  { href: "#how", label: "작동 방식" },
  { href: "#features", label: "기능" },
  { href: "#install", label: "설치" },
  { href: "#security", label: "보안" },
];

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const logo = useRef<SVGSVGElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => onLandingReady(() => logo.current && hop(logo.current)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-20 border-b transition-colors duration-300 ${
        solid ? "border-(--ld-border) bg-[rgb(255_255_255/0.82)] backdrop-blur-md" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-8 px-5 lg:px-10">
        <a
          href="#"
          id={NAV_LOGO_ID}
          aria-label="Orion 홈"
          className="block h-[26px]"
          onMouseEnter={() => logo.current && hop(logo.current)}
        >
          <OrionLogo ref={logo} />
        </a>
        <nav aria-label="주요 메뉴" className="hidden gap-7 text-sm text-(--ld-text-2) min-[900px]:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-(--ld-text)">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/login" className="hidden text-sm text-(--ld-text-2) hover:text-(--ld-text) min-[900px]:block">
            로그인
          </Link>
          <Link href="/signup" className={`${btnPrimary} px-4! py-2.5! text-sm!`}>
            무료로 시작하기
          </Link>
          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="orion-menu"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setOpen(!open)}
            className="grid size-10 place-items-center rounded-full border border-(--ld-border-strong) text-lg min-[900px]:hidden"
          >
            {open ? <XIcon aria-hidden /> : <ListIcon aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="orion-menu"
          aria-label="모바일 메뉴"
          className="grid border-t border-(--ld-border) bg-(--ld-bg) px-5 pt-2 pb-5 min-[900px]:hidden"
          onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}
        >
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="border-b border-(--ld-border) py-3.5">
              {item.label}
            </a>
          ))}
          <Link href="/login" className="border-b border-(--ld-border) py-3.5">
            로그인
          </Link>
        </nav>
      )}
    </header>
  );
}


const RUN: { icon: Icon; title: string; meta: string; verdict?: boolean }[] = [
  { icon: CameraIcon, title: "신고 접수", meta: "“결제 버튼이 안 눌려요”" },
  { icon: SparkleIcon, title: "해석 · 계획", meta: "7단계, 범위 검사 통과" },
  { icon: BrowserIcon, title: "시도 1/2", meta: "Chromium · 재현됨" },
  { icon: BrowsersIcon, title: "시도 2/2", meta: "Chromium · 재현됨" },
  { icon: BugIcon, title: "REPRODUCED", meta: "근거와 함께 리포트 생성", verdict: true },
];

export function RunCard() {
  const [step, setStep] = useState(-1);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    const stop = onLandingReady(() => {
      if (reducedMotion()) return setStep(RUN.length - 1);
      setStep(-1);
      RUN.forEach((_, i) => timers.push(window.setTimeout(() => setStep(i), 500 + i * 650)));
    });
    return () => {
      stop();
      timers.forEach(clearTimeout);
    };
  }, [round]);

  return (
    <div
      role="region"
      aria-label="재현 실행 예시"
      className="ld-in w-full max-w-[440px] justify-self-end rounded-[14px] border border-(--ld-border-strong) bg-[rgb(255_255_255/0.82)] p-5 shadow-[0_18px_50px_-24px_rgb(11_16_32/0.25)] backdrop-blur-md [transition-delay:.35s]"
    >
      <div className="mb-3.5 flex items-center justify-between font-mono text-[13px] text-(--ld-text-2)">
        <span className="flex items-center gap-2">
          run #482 <Sample />
        </span>
        <button
          type="button"
          aria-label="다시 실행"
          onClick={() => setRound(round + 1)}
          className="p-1 text-base text-(--ld-text-3) hover:text-(--ld-text)"
        >
          <ArrowCounterClockwiseIcon aria-hidden />
        </button>
      </div>
      <ol className="grid gap-1">
        {RUN.map(({ icon: StepIcon, title, meta, verdict }, i) => {
          const on = i <= step;
          return (
            <li
              key={title}
              className={`grid grid-cols-[34px_1fr_auto] items-center gap-2.5 rounded-[10px] px-1.5 py-2 transition duration-400 ${
                on ? "opacity-100" : "opacity-25"
              } ${on && verdict ? "bg-[rgb(215_48_63/0.1)]" : i === step ? "bg-[rgb(11_16_32/0.05)]" : ""}`}
            >
              <span
                className={`grid size-[34px] place-items-center rounded-[9px] text-[17px] ${
                  verdict ? "bg-(--ld-red) text-white" : `bg-(--ld-surface-2) ${on ? "text-(--ld-text)" : "text-(--ld-text-2)"}`
                }`}
              >
                <StepIcon aria-hidden />
              </span>
              <span>
                <span
                  className={`block text-[15px] font-semibold ${verdict ? "font-mono tracking-[.04em] text-(--ld-red-ink)" : ""}`}
                >
                  {title}
                </span>
                <span className="block text-[12.5px] text-(--ld-text-3)">{meta}</span>
              </span>
              <span className={on ? "text-(--ld-ok)" : "text-(--ld-text-3)"}>
                {verdict ? <FileTextIcon aria-hidden /> : <CheckIcon aria-hidden />}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Sample() {
  return (
    <span className="rounded-full border border-(--ld-border-strong) px-1.5 py-[3px] text-[11px] leading-none font-semibold text-(--ld-text-3)">
      예시
    </span>
  );
}


const STEPS: { icon: Icon; title: string; body: string }[] = [
  { icon: CameraIcon, title: "신고", body: "사이트의 신고 버튼으로 스크린샷과 한 줄 설명을 보냅니다." },
  { icon: SparkleIcon, title: "해석", body: "화면의 사실과 가설을 나누고, 부족하면 먼저 묻습니다." },
  { icon: BrowsersIcon, title: "재현", body: "독립된 두 브라우저에서 실행하고 매 동작을 기록합니다." },
  { icon: SealCheckIcon, title: "보고 · 재검증", body: "근거와 함께 보고하고, 수정 후 같은 계획으로 다시 확인합니다." },
];

export function Flow() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduce = reducedMotion();
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      if (reduce) return setProgress(1);
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setProgress(Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height + vh * 0.25))));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} className="relative mt-14 grid gap-7 min-[900px]:grid-cols-4 min-[900px]:gap-6">
      <div aria-hidden className="absolute inset-x-8 top-[31px] hidden h-0.5 bg-(--ld-lane-2) min-[900px]:block">
        <span className="absolute inset-0 origin-left bg-(--ld-red)" style={{ transform: `scaleX(${progress})` }} />
      </div>
      {STEPS.map(({ icon: StepIcon, title, body }, i) => {
        const lit = progress >= i / (STEPS.length - 1) - 0.02 || progress >= 0.999;
        return (
          <div key={title} className="relative grid grid-cols-[64px_1fr] items-start gap-[18px] min-[900px]:grid-cols-1">
            <div
              className={`grid size-16 place-items-center rounded-[18px] border text-[27px] transition duration-500 ${
                lit
                  ? "border-(--ld-red) bg-(--ld-red) text-white shadow-[0_10px_30px_-10px_rgb(215_48_63/0.7)]"
                  : "border-(--ld-border-strong) bg-(--ld-surface) text-(--ld-text-2)"
              }`}
            >
              <StepIcon aria-hidden />
            </div>
            <div>
              <span className="mb-1.5 block font-mono text-xs text-(--ld-text-3)">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mb-1.5 text-xl font-bold">{title}</h3>
              <p className="max-w-[26ch] text-[15px] text-(--ld-text-2)">{body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function Counter({ to, unit }: { to: number; unit: string }) {
  const [value, setValue] = useState(0);
  const ref = useOnceInView<HTMLElement>((instant) => {
    if (instant) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1100);
      setValue(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });
  return (
    <b ref={ref} className="block text-[2.6rem] leading-none font-bold tracking-[-.02em] tabular-nums">
      {value}
      <small className="ml-1 text-lg font-semibold text-(--ld-text-2)">{unit}</small>
    </b>
  );
}


export function Retest() {
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const ref = useOnceInView<HTMLDivElement>((instant) => {
    if (instant) {
      setPhase("done");
      return;
    }
    const timers: number[] = [];
    const cycle = () => {
      setPhase("idle");
      timers.push(window.setTimeout(() => setPhase("run"), 50));
      timers.push(window.setTimeout(() => setPhase("done"), 1350));
    };
    cycle();
    const loop = window.setInterval(cycle, 4200);
    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  });
  return (
    <div
      ref={ref}
      className={`ld-demo flex items-center justify-between gap-3 ${phase === "idle" ? "" : "is-run"} ${phase === "done" ? "is-done" : ""}`}
    >
      <span className="flex items-center gap-2.5 text-sm">
        <BugIcon aria-hidden className="text-2xl text-(--ld-red-hover)" />
        수정 전
      </span>
      <span aria-hidden className="ld-rt-arrow relative h-0.5 flex-1 overflow-hidden bg-(--ld-lane-2)" />
      <span aria-live="polite" className="relative min-w-32 text-sm">
        <span className="ld-rt-wait flex items-center gap-2.5">
          <CircleNotchIcon aria-hidden className="ld-spin text-2xl text-(--ld-text-3)" />
          재검증 중
        </span>
        <span className="ld-rt-pass absolute inset-0 flex items-center gap-2.5">
          <CheckCircleIcon aria-hidden className="text-2xl text-(--ld-ok)" />
          재현 안 됨
        </span>
      </span>
    </div>
  );
}


export function CopySnippet({ code }: { code: string }) {
  const [status, setStatus] = useState("");
  const pre = useRef<HTMLPreElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("복사됨");
    } catch {
      const range = document.createRange();
      if (pre.current) range.selectNodeContents(pre.current);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setStatus("선택됨, ⌘C");
    }
    setTimeout(() => setStatus(""), 1500);
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-(--ld-border-strong) bg-(--ld-surface)">
      <div className="flex items-center justify-between border-b border-(--ld-border) py-2.5 pr-3 pl-4 font-mono text-[13px] text-(--ld-text-3)">
        <span>index.html</span>
        <span className="flex items-center">
          <span role="status" className="mr-2.5 text-(--ld-ok)">
            {status}
          </span>
          <button type="button" onClick={copy} className={`${btnGhost} px-4! py-2.5! text-sm!`}>
            <CopyIcon aria-hidden />
            복사
          </button>
        </span>
      </div>
      <pre ref={pre} className="overflow-x-auto px-[18px] py-[22px] font-mono text-[13.5px] leading-[1.75] text-(--ld-text-2)">
        {code}
      </pre>
    </div>
  );
}
