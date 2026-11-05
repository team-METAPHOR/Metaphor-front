import { AccountView } from "./account-view";

// 로그인 확인이 브라우저의 AuthGate에서 일어나 프리렌더에서는 이 페이지가 그려지지 않는다.
// layout의 instant = false는 하위 세그먼트에 상속되지 않으므로 페이지에서도 끈다.
export const instant = false;

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">계정 설정</h1>
        <p className="mt-1 text-sm text-muted">내 계정 정보를 보고 비밀번호를 바꿔요.</p>
      </div>
      <AccountView />
    </div>
  );
}
