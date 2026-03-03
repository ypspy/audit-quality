import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { DocLayout } from "@/components/DocLayout";
import { parseNav } from "@/lib/mkdocs-nav";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "정책과 절차",
  description: "선진회계법인 정책·내규·품질관리절차",
};

export default function PolicyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { items } = parseNav("policy");
  return (
    <div className={`${notoSansKr.variable} font-[family-name:var(--font-noto-sans-kr)]`}>
      <DocLayout nav={items}>{children}</DocLayout>
    </div>
  );
}
