const pill =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-[22px] py-3.5 text-[15px] leading-none font-semibold transition active:scale-[0.97]";

export const btnPrimary = `${pill} border-transparent bg-(--ld-red) text-white hover:bg-(--ld-red-hover)`;

export const btnGhost = `${pill} border-(--ld-border-strong) bg-[rgb(11_16_32/0.04)] text-(--ld-text) backdrop-blur-sm hover:border-[rgb(11_16_32/0.22)]`;

export const sectionTitle = "max-w-[20ch] text-[clamp(1.8rem,3.8vw,2.9rem)] leading-[1.18] font-bold tracking-[-.02em]";

export const wrap = "mx-auto max-w-[1200px] px-5 lg:px-10";
