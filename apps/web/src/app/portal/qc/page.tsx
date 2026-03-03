import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PortalQCClient from "./PortalQCClient";

export default async function PortalQCPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const hasAccess = roles.some((r) => ["admin", "qc-manager"].includes(r));

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
          접근 권한이 없습니다
        </h2>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          품질관리실 전용 페이지입니다. admin 또는 qc-manager 역할이 필요합니다.
        </p>
      </div>
    );
  }

  return <PortalQCClient />;
}
