import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClientPageClient } from "./ClientPageClient";

export default async function ClientPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">현장 조회</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          고객 정보를 검색하고 조회합니다. 파트너별 필터, Split View, 탭을 지원합니다.
        </p>
      </header>
      <Suspense fallback={<div className="p-4 text-gray-500">불러오는 중...</div>}>
        <ClientPageClient />
      </Suspense>
    </div>
  );
}
