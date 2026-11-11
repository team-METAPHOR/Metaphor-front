import type { Metadata } from "next";
import { Landing } from "./_landing/landing";
import "./_landing/landing.css";

export const metadata: Metadata = {
  title: "Orion",
  description: "스크린샷 한 장으로 신고된 웹 버그를 AI가 실제 브라우저에서 두 번 재현하고 근거와 함께 보고합니다.",
};

export default function Home() {
  return <Landing />;
}
