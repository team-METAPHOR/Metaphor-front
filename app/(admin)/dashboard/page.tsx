import { DashboardView } from "./dashboard-view";

// 로그인 확인이 브라우저의 AuthGate에서 일어나 프리렌더에서는 이 페이지가 그려지지 않는다.
// layout의 instant = false는 하위 세그먼트에 상속되지 않으므로 페이지에서도 끈다.
export const instant = false;

export default function DashboardPage() {
  return (
    <>
      <h1 className="sr-only">대시보드</h1>
      <DashboardView />
    </>
  );
}
