import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  ArrowsCounterClockwiseIcon,
  BroadcastIcon,
  BrowsersIcon,
  BugIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CodeIcon,
  CpuIcon,
  CursorIcon,
  EyeSlashIcon,
  FileCodeIcon,
  FilmStripIcon,
  HandIcon,
  HandPalmIcon,
  HourglassIcon,
  KeyIcon,
  KeyboardIcon,
  LockKeyIcon,
  LockSimpleIcon,
  QuotesIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  UserCircleIcon,
  UserPlusIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Intro } from "./intro";
import { Lanes } from "./lanes";
import { Counter, CopySnippet, Flow, InViewClass, NavBar, Retest, Reveal, RunCard, Sample } from "./motion";
import { HoverLogo } from "./orion-logo";
import { btnGhost, btnPrimary, sectionTitle, wrap } from "./styles";

const SNIPPET = `<script src="https://api.<orion>/sdk/v1/metaphor.js"
        data-metaphor-project-key="mpk_..."
        defer></script>`;

const VOICES = [
  { quote: "안 돼요", icon: HourglassIcon, text: "되묻는 사이 맥락이 사라집니다" },
  { quote: "결제가 좀 이상해요", icon: HandIcon, text: "재현은 여전히 수작업입니다" },
  { quote: "또 그래요", icon: ArrowsCounterClockwiseIcon, text: "재현 못 한 버그는 다시 돌아옵니다" },
];

const STATS = [
  { icon: BrowsersIcon, to: 2, unit: "번", text: "독립된 브라우저에서 재현" },
  { icon: CpuIcon, to: 6, unit: "번", text: "작업당 최대 모델 호출" },
  { icon: QuotesIcon, to: 100, unit: "%", text: "원인 가설마다 증거 번호 인용" },
];

const SECURITY: { icon: Icon; title: string; body: ReactNode }[] = [
  { icon: KeyboardIcon, title: "입력값 미수집", body: "키 입력, 쿠키, 요청 본문은 기록하지 않습니다." },
  {
    icon: EyeSlashIcon,
    title: "지정 영역 가림",
    body: (
      <>
        <code className="font-mono text-[13px] text-(--ld-text)">mask_selectors</code> 영역은 화면과 영상에서 가려집니다.
      </>
    ),
  },
  { icon: HandPalmIcon, title: "동의한 정보만", body: "사용자가 동의한 항목만 전송됩니다." },
  { icon: LockKeyIcon, title: "계정 암호화", body: "테스트 계정은 공개키로 암호화해 저장합니다." },
  { icon: ShieldCheckIcon, title: "정해진 범위 안에서만", body: "허용된 도메인·경로·시간 안에서만 실행합니다." },
  { icon: CodeIcon, title: "코드는 그대로", body: "찾고 확인할 뿐, 패치나 PR은 만들지 않습니다." },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="ld-eyebrow mb-4">{children}</p>;
}

function Cell({
  icon: CellIcon,
  title,
  body,
  className,
  children,
}: {
  icon: Icon;
  title: string;
  body?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Reveal
      className={`flex flex-col gap-5 overflow-hidden rounded-[14px] border border-(--ld-border) bg-(--ld-surface) p-6 ${className ?? ""}`}
    >
      <div>
        <h3 className="flex items-center gap-2.5 text-lg font-bold">
          <CellIcon aria-hidden className="text-xl text-(--ld-red-hover)" />
          {title}
        </h3>
        {body && <p className="mt-1.5 text-[15px] text-(--ld-text-2)">{body}</p>}
      </div>
      {children}
    </Reveal>
  );
}

function Chip({ icon: ChipIcon, children }: { icon?: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--ld-border) bg-(--ld-bg) px-3 py-2 font-mono text-[12.5px] leading-none text-(--ld-text-2)">
      {ChipIcon && <ChipIcon aria-hidden className="text-[15px] text-(--ld-text)" />}
      {children}
    </span>
  );
}

export function Landing() {
  return (
    <div className="ld overflow-x-clip">
      <noscript>
        <style>{`.ld-intro{display:none!important}.ld-in{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <Intro />
      <NavBar />

      <main>
        <section className="relative flex min-h-dvh items-center overflow-hidden pt-[120px] pb-20">
          <Lanes kind="hero" />
          <div aria-hidden className="ld-hero-shade pointer-events-none absolute inset-0" />
          <div className={`${wrap} relative z-1 grid w-full items-center gap-12 lg:grid-cols-[1.1fr_.9fr]`}>
            <div>
              <h1 className="ld-in mb-5 text-[clamp(2.3rem,6vw,4.4rem)] leading-[1.12] font-bold tracking-[-.02em] [transition-delay:.05s]">
                “이거 안돼요”가
                <br />
                <em className="text-(--ld-red-hover) not-italic">재현 리포트</em>가 되기까지.
              </h1>
              <p className="ld-in mb-8 max-w-[40ch] text-[clamp(1rem,1.4vw,1.15rem)] text-(--ld-text-2) [transition-delay:.15s]">
                스크린샷 한 장이면 충분합니다. AI가 실제 브라우저에서 두 번 재현하고, 근거를 붙여 보고합니다.
              </p>
              <div className="ld-in flex flex-wrap gap-3 [transition-delay:.25s]">
                <Link href="/signup" className={btnPrimary}>
                  무료로 시작하기 <ArrowRightIcon aria-hidden />
                </Link>
                <a href="#how" className={btnGhost}>
                  작동 방식
                </a>
              </div>
            </div>
            <RunCard />
          </div>
          <CaretDownIcon aria-hidden className="ld-bob absolute bottom-6 left-1/2 z-1 text-xl text-(--ld-text-3)" />
        </section>

        <section className="pt-(--ld-gap)" aria-labelledby="problem-title">
          <div className={wrap}>
            <Reveal>
              <Eyebrow>문제</Eyebrow>
              <h2 id="problem-title" className={sectionTitle}>
                버그 수정보다
                <br />
                재현이 더 오래 걸립니다.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 min-[900px]:grid-cols-3">
              {VOICES.map(({ quote, icon: VoiceIcon, text }, i) => (
                <Reveal key={quote} delay={i * 0.1} className="border-t border-(--ld-border-strong) pt-[22px]">
                  <q className="mb-2.5 block text-[1.35rem] font-bold">{quote}</q>
                  <p className="flex items-center gap-2 text-[15px] text-(--ld-text-2)">
                    <VoiceIcon aria-hidden className="text-lg text-(--ld-red-hover)" />
                    {text}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="pt-(--ld-gap)" aria-labelledby="how-title">
          <div className={wrap}>
            <Reveal>
              <Eyebrow>작동 방식</Eyebrow>
              <h2 id="how-title" className={sectionTitle}>
                신고부터 재검증까지, 네 단계.
              </h2>
            </Reveal>
            <Flow />
          </div>
        </section>

        <section aria-label="판정 원칙" className="relative mt-(--ld-gap) overflow-hidden border-y border-(--ld-border)">
          <Lanes kind="band" className="opacity-90" />
          <div aria-hidden className="ld-band-shade absolute inset-0" />
          <div className={`${wrap} relative z-1 py-24`}>
            <Reveal>
              <p className="mb-14 max-w-[22ch] text-[clamp(1.6rem,3.6vw,2.6rem)] leading-tight font-bold tracking-[-.02em]">
                판정은 AI의 의견이 아니라
                <br />
                <b className="text-(--ld-red-hover)">실행 기록</b>으로 계산합니다.
              </p>
            </Reveal>
            <div className="grid gap-7 md:grid-cols-3">
              {STATS.map(({ icon: StatIcon, to, unit, text }, i) => (
                <Reveal key={text} delay={i * 0.1} className="flex items-start gap-4">
                  <StatIcon aria-hidden className="mt-2 text-2xl text-(--ld-red-hover)" />
                  <div>
                    <Counter to={to} unit={unit} />
                    <span className="text-[15px] text-(--ld-text-2)">{text}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="pt-(--ld-gap)" aria-labelledby="features-title">
          <div className={wrap}>
            <Reveal>
              <Eyebrow>기능</Eyebrow>
              <h2 id="features-title" className={sectionTitle}>
                리포트 하나에 필요한 모든 근거.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 min-[900px]:auto-rows-[minmax(200px,auto)] min-[900px]:grid-cols-6">
              <Cell
                icon={RepeatIcon}
                title="두 번 재현, 기록으로 판정"
                body="화면, 요청, 콘솔 오류까지 남겨 누구나 같은 결론을 확인합니다."
                className="min-[900px]:col-span-3 min-[900px]:row-span-2"
              >
                <div className="ld-demo mt-auto" aria-label="QA 리포트 예시">
                  <InViewClass className="ld-attempts grid gap-3">
                    {["시도 1/2", "시도 2/2"].map((label) => (
                      <div key={label} className="grid grid-cols-[70px_1fr_80px] items-center gap-3 font-mono text-[12.5px] text-(--ld-text-2)">
                        <span>{label}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-(--ld-lane-2)">
                          <span className="ld-bar block h-full bg-(--ld-red)" />
                        </span>
                        <em className="ld-bar-label text-right text-[13px] not-italic text-(--ld-red-ink)">재현됨</em>
                      </div>
                    ))}
                  </InViewClass>
                  <div className="mt-[18px] grid gap-1.5 font-mono text-[12px] text-(--ld-text-2)">
                    {[
                      ["e7", "POST /api/checkout", "409"],
                      ["e9", "console", "TypeError"],
                      ["e2", "screenshots", "14"],
                    ].map(([id, what, value]) => (
                      <div key={id} className="flex justify-between gap-3 rounded-lg bg-[rgb(238_241_247/0.03)] px-2.5 py-2">
                        <span>
                          <span className="mr-2 text-(--ld-red-hover)">{id}</span>
                          {what}
                        </span>
                        <b className="font-semibold text-(--ld-text)">{value}</b>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[rgb(215_48_63/0.14)] px-3 py-2 font-mono text-[12.5px] leading-none font-semibold tracking-[.04em] text-(--ld-red-ink)">
                      <BugIcon aria-hidden />
                      REPRODUCED
                    </span>
                    <Sample />
                  </div>
                </div>
              </Cell>

              <Cell
                icon={ArrowsClockwiseIcon}
                title="같은 계획으로 재검증"
                body="수정을 배포하고 버튼 하나로 다시 확인하세요."
                className="min-[900px]:col-span-3"
              >
                <Retest />
              </Cell>

              <Cell icon={BroadcastIcon} title="재현 과정을 실시간으로" className="min-[900px]:col-span-3">
                <div aria-hidden className="ld-demo mt-auto overflow-hidden p-0!">
                  <div className="flex items-center gap-1.5 border-b border-(--ld-border) px-2.5 py-2 font-mono text-[11px] text-(--ld-text-3)">
                    {[0, 1, 2].map((i) => (
                      <i key={i} className="size-2 rounded-full bg-(--ld-lane-2)" />
                    ))}
                    <span className="ml-1.5">shop.example/cart</span>
                    <span className="ld-live ml-auto inline-flex items-center gap-1.5 text-(--ld-red-ink)">LIVE</span>
                  </div>
                  <div className="relative grid h-[130px] grid-cols-[1fr_110px] gap-3 p-3.5">
                    <div className="grid content-start gap-2">
                      <span className="h-2 rounded bg-(--ld-lane-2)" />
                      <span className="h-2 w-[70%] rounded bg-(--ld-lane-2)" />
                      <span className="h-2 w-[85%] rounded bg-(--ld-lane-2)" />
                    </div>
                    <div className="grid h-[34px] place-items-center self-end rounded-lg bg-(--ld-surface-2) text-xs text-(--ld-text-2)">
                      결제하기
                    </div>
                    <span className="ld-ripple absolute right-[60px] bottom-[30px] -m-[5px] size-2.5 rounded-full border-2 border-(--ld-red-hover)" />
                    <CursorIcon className="ld-cursor absolute text-[22px] text-white drop-shadow-[0_2px_4px_rgb(0_0_0/0.6)]" />
                  </div>
                  <div className="border-t border-(--ld-border) px-2.5 py-2 text-[12.5px] text-(--ld-text-2)">
                    3/7 결제하기 버튼 클릭
                  </div>
                </div>
              </Cell>

              <Cell icon={SquaresFourIcon} title="조건별 비교" body="어디서만 깨지는지 찾습니다." className="min-[900px]:col-span-2">
                <InViewClass
                  label="브라우저와 화면 크기 비교 예시"
                  className="ld-matrix mt-auto grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5 font-mono text-[11.5px] text-(--ld-text-3)"
                >
                  <span />
                  {["Chromium", "Firefox", "WebKit"].map((b) => (
                    <span key={b} className="text-center">
                      {b}
                    </span>
                  ))}
                  {[
                    ["390px", [true, true, false]],
                    ["1440px", [true, true, true]],
                  ].map(([size, results], row) => (
                    <Row key={size as string} size={size as string} results={results as boolean[]} row={row} />
                  ))}
                </InViewClass>
              </Cell>

              <Cell icon={FilmStripIcon} title="영상과 테스트 코드" body="잡은 버그는 회귀 테스트로 남습니다." className="min-[900px]:col-span-2">
                <div className="mt-auto flex flex-wrap gap-2">
                  <Chip icon={FilmStripIcon}>run-482.webm</Chip>
                  <Chip icon={FileCodeIcon}>run-482.spec.ts</Chip>
                </div>
              </Cell>

              <Cell icon={UserCircleIcon} title="로그인 화면도" body="테스트 계정으로 매 시도 로그인합니다." className="min-[900px]:col-span-2">
                <div className="mt-auto flex flex-wrap gap-2">
                  <Chip icon={LockSimpleIcon}>qa@yourapp.com</Chip>
                  <Chip>••••••••</Chip>
                </div>
              </Cell>
            </div>
          </div>
        </section>

        <section id="install" className="pt-(--ld-gap)" aria-labelledby="install-title">
          <div className={`${wrap} grid items-center gap-10 min-[960px]:grid-cols-[.9fr_1.1fr]`}>
            <Reveal>
              <Eyebrow>설치</Eyebrow>
              <h2 id="install-title" className={sectionTitle}>
                스크립트 한 줄이면
                <br />
                신고 버튼이 생깁니다.
              </h2>
              <ol className="mt-8 flex flex-wrap items-center gap-2.5">
                {[
                  { icon: UserPlusIcon, text: "가입" },
                  { icon: KeyIcon, text: "키 발급" },
                  { icon: CodeIcon, text: "붙여넣기" },
                ].map(({ icon: StepIcon, text }, i) => (
                  <li key={text} className="flex items-center gap-2.5">
                    {i > 0 && <CaretRightIcon aria-hidden className="text-(--ld-text-3)" />}
                    <span className="inline-flex items-center gap-2 rounded-full border border-(--ld-border) bg-(--ld-surface) px-3.5 py-2.5 text-[15px]">
                      <StepIcon aria-hidden className="text-(--ld-red-hover)" />
                      {text}
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="mt-6 grid gap-2.5 text-[15px] text-(--ld-text-2)">
                {["gzip 50KB 이하", "무결성 해시(SRI) 포함 버전 고정 URL", "버튼을 숨겨도 오류 자동 감지는 동작"].map((point) => (
                  <li key={point} className="flex items-center gap-2.5">
                    <CheckCircleIcon aria-hidden className="text-(--ld-ok)" />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal>
              <CopySnippet code={SNIPPET} />
            </Reveal>
          </div>
        </section>

        <section id="security" className="pt-(--ld-gap)" aria-labelledby="security-title">
          <div className={wrap}>
            <Reveal>
              <Eyebrow>보안과 개인정보</Eyebrow>
              <h2 id="security-title" className={sectionTitle}>
                필요한 것만 보고,
                <br />
                나머지는 가립니다.
              </h2>
            </Reveal>
            <Reveal className="mt-12 grid gap-px overflow-hidden rounded-[14px] border border-(--ld-border) bg-(--ld-border) sm:grid-cols-2 lg:grid-cols-3">
              {SECURITY.map(({ icon: SecIcon, title, body }) => (
                <div key={title} className="grid gap-2 bg-(--ld-bg) px-6 py-7">
                  <SecIcon aria-hidden className="text-[26px] text-(--ld-red-hover)" />
                  <b>{title}</b>
                  <span className="text-[14px] text-(--ld-text-2)">{body}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="relative mt-(--ld-gap) overflow-hidden py-[120px] text-center" aria-labelledby="final-title">
          <Lanes kind="final" className="opacity-80" />
          <div aria-hidden className="ld-final-shade absolute inset-0" />
          <div className={`${wrap} relative z-1 grid justify-items-center gap-5`}>
            <Reveal>
              <HoverLogo label="Orion" className="mb-3 h-16 cursor-pointer" />
            </Reveal>
            <Reveal>
              <h2 id="final-title" className={`${sectionTitle} max-w-[18ch]`}>
                다음 버그 제보는
                <br />
                재현된 채로 받아 보세요.
              </h2>
            </Reveal>
            <Reveal>
              <p className="text-(--ld-text-2)">스크립트만 지우면 언제든 해지됩니다.</p>
            </Reveal>
            <Reveal className="mt-3 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className={btnPrimary}>
                무료로 시작하기 <ArrowRightIcon aria-hidden />
              </Link>
              <Link href="/login" className={btnGhost}>
                로그인
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--ld-border) pt-12 pb-10 text-sm text-(--ld-text-3)">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-8`}>
          <HoverLogo label="Orion" className="h-[22px]" />
          <nav aria-label="푸터" className="flex flex-wrap gap-6">
            <a href="#how" className="hover:text-(--ld-text)">
              작동 방식
            </a>
            <a href="#features" className="hover:text-(--ld-text)">
              기능
            </a>
            <a href="#security" className="hover:text-(--ld-text)">
              보안
            </a>
            <a href="https://github.com/NONAMEDKERNEL" className="hover:text-(--ld-text)">
              GitHub
            </a>
          </nav>
          <span>© 2026 Orion</span>
        </div>
      </footer>
    </div>
  );
}

function Row({ size, results, row }: { size: string; results: boolean[]; row: number }) {
  return (
    <>
      <span>{size}</span>
      {results.map((ok, col) => (
        <span
          key={col}
          className={`ld-cell grid h-7 place-items-center rounded-md text-[15px] ${
            ok ? "bg-(--ld-lane-1) text-(--ld-ok)" : "bg-(--ld-red) text-white"
          }`}
          style={{ transitionDelay: `${0.1 + (row * 3 + col) * 0.1}s` }}
        >
          {ok ? "✓" : "✕"}
        </span>
      ))}
    </>
  );
}
