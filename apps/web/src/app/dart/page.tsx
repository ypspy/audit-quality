import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DartPageClient } from "./DartPageClient";

export default async function DartPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">DART 공시</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          감사보고서 등 공시 메타데이터를 검색하고 조회합니다. 원문은 DART에서 제공됩니다.
        </p>
      </header>
      <DartPageClient />
    </div>
  );
}
