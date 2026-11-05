import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";
import { Providers } from "./providers";

// 본문 글꼴. Figma 디자인 기준.
const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 버그 번호, 경로, 코드
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SPEAR",
  description: "버그 신고 및 재현 정보 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme은 아래 스크립트가 첫 화면 전에 저장된 값으로 바꾼다.
    <html
      lang="ko"
      data-theme="dark"
      suppressHydrationWarning
      className={`${pretendard.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script
          // React가 클라이언트에서 <script>를 다시 그리며 경고하지 않도록 서버에서만 실행 타입을 준다.
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
