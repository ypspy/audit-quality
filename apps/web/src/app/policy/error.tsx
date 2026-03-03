"use client";

import Link from "next/link";

export default function PolicyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h2 className="text-lg font-semibold text-foreground">문서를 불러올 수 없습니다</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        정책 문서 로딩 중 오류가 발생했습니다.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/policy"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          정책 목록으로
        </Link>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-600"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
