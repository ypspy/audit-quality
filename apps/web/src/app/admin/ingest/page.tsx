import { IngestClient } from "./IngestClient";

export default function IngestPage() {
  return (
    <div className="flex-1 min-w-0 flex justify-center">
      <div className="w-full max-w-2xl px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          규제 업데이트 입수
        </h1>
        <IngestClient />
      </div>
    </div>
  );
}
