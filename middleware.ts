import { NextResponse, type NextRequest } from "next/server";

// 배포별 역할을 환경변수로 구분한다.
//   SITE_MODE=app      → 본 서비스(로그인·대시보드). 루트는 서비스로 보낸다.
//   SITE_MODE=landing  → 랜딩(마케팅·회원가입). 본 서비스 경로는 앱 도메인으로 넘긴다.
// 미설정 시 landing으로 둔다(랜딩 우선).
const MODE = process.env.SITE_MODE === "app" ? "app" : "landing";

// 랜딩에서 본 서비스로 넘길 때 사용하는 앱 도메인. 예) https://orion-app.vercel.app
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

// 본 서비스 전용 경로(랜딩에서는 앱 도메인으로 보낸다).
const APP_ONLY = ["/dashboard", "/reports", "/login"];
const isAppOnly = (path: string) => APP_ONLY.some((p) => path === p || path.startsWith(`${p}/`));

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (MODE === "app") {
    // 본 서비스: 랜딩 루트를 서비스 진입점으로 보낸다. 회원가입은 랜딩으로 안내.
    if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // 랜딩 모드: 본 서비스 경로는 앱 도메인으로 넘긴다(앱 URL이 설정된 경우에만).
  if (APP_URL && isAppOnly(pathname)) {
    return NextResponse.redirect(`${APP_URL}${pathname}${search}`);
  }
  return NextResponse.next();
}

export const config = {
  // 정적 파일·_next·/api(백엔드 프록시)는 건드리지 않는다.
  matcher: ["/", "/dashboard/:path*", "/reports/:path*", "/login"],
};
