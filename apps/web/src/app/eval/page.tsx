import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { EvalPageClient } from "./EvalPageClient";

export default async function EvalPage({
  searchParams,
}: {
  searchParams?: Promise<{
    preparer?: string;
    status?: string;
    yearend?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const filters = searchParams ? await searchParams : undefined;
  return <EvalPageClient initialFilters={filters} />;
}
