import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { DocLayout } from "@/components/DocLayout";
import { UpdatesChat } from "@/components/UpdatesChat";
import { parseNav } from "@/lib/mkdocs-nav";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "규제 업데이트",
  description: "회계·감사 규제 모니터링 — 금융위·금감원·회계기준원 시기별 업데이트",
};

export default function UpdatesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { items } = parseNav("updates");
  return (
    <div className={`${notoSansKr.variable} font-[family-name:var(--font-noto-sans-kr)]`}>
      <DocLayout nav={items}>{children}</DocLayout>
      <UpdatesChat />
    </div>
  );
}
