"use client";

import { useState } from "react";

const tabs = [
  { id: "approval", label: "사전심리 완료 발행승인", jotform: "210468682019458" },
  { id: "tracking", label: "QC Issue Tracking", jotform: "231377451685463" },
  { id: "discipline", label: "징계사항 징계부 등록", jotform: "213503391701446" },
];

export default function PortalQCClient() {
  const [activeTab, setActiveTab] = useState("approval");
  const activeJotform = tabs.find((t) => t.id === activeTab)?.jotform;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">선진회계법인 품질관리실</h1>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-200 dark:bg-gray-700 text-foreground"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeJotform && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <iframe
            title="QC JotForm"
            src={`https://form.jotform.com/${activeJotform}?isIframeEmbed=1`}
            frameBorder="0"
            className="min-h-[600px] w-full"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
