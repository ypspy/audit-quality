"use client";

import { useState } from "react";

const tabs = [
  { id: "forms", label: "현행서식파일", active: true },
  { id: "online", label: "온라인 접수 서식", active: false },
  { id: "contract", label: "계약체결보고", jotform: "210457499793471" },
  { id: "qc-review", label: "품질관리검토", jotform: "220091292211038" },
  { id: "pre-review", label: "사전심리", jotform: "230147442738456" },
  { id: "drt", label: "발행-DRT생성", jotform: "210481470782455" },
  { id: "print", label: "발행-인쇄", jotform: "220647374027455" },
  { id: "erp", label: "ERP초기입고", jotform: "221041436310438" },
];

const formLinks = [
  { category: "계약", items: [
    { name: "외부감사법 감사업무 표준계약서", links: [
      { label: "일반기업 (2023)", url: "https://docs.google.com/uc?export=download&id=1nu8ob7wEeYU0Uwz4Pp0Wo7Socc9tV2yI&confirm=t" },
      { label: "KIFRS/상장기업(2023)", url: "https://docs.google.com/uc?export=download&id=1msLINhCVrjI84OhAnVR_KD1ePCXG975E&confirm=t" },
    ]},
    { name: "업무수임유지 평가서식", links: [
      { label: "감사업무 (2023)", url: "https://docs.google.com/uc?export=download&id=1Td0ZkWflaqKC4c9PO-1-1d8DC8noeR4n&confirm=t" },
      { label: "품질관리실장 승인대상 비감사업무 (2023)", url: "https://docs.google.com/uc?export=download&id=1wiXmSLVAFAA1uJdcJxCdKcCoFOrXoag5&confirm=t" },
    ]},
  ]},
  { category: "발행", items: [
    { name: "인감관리대장", links: [{ label: "인감관리대장 (2022)", url: "https://docs.google.com/uc?export=download&id=1TpVyihqwL1ifpstd7uSeZQ4hY4KF7iVG&confirm=t" }]},
    { name: "인감등록대장", links: [{ label: "인감등록대장 (2022)", url: "https://docs.google.com/uc?export=download&id=1NwBWnRvTxt7orlqIyGYE3W8GHpRjzugM&confirm=t" }]},
  ]},
  { category: "업무의 수행", items: [
    { name: "감사조서서식(KICPA)", links: [
      { label: "감사조서서식(엑셀) 2023", url: "https://docs.google.com/uc?export=download&id=1o-2lJ7bITtE2sHOGXa5EE7k9UqSyt8MD&confirm=t" },
      { label: "감사조서서식(한글) 2023", url: "https://docs.google.com/uc?export=download&id=11yUDryd0A-afIWX7Mh7_nYcegxLtbT5H&confirm=t" },
      { label: "감사조서서식 개정사항총괄 2023", url: "https://docs.google.com/uc?export=download&id=14JBVStczIfb19sITqHI98GQ1JSGff39j&confirm=t" },
      { label: "2700A 중요성 요약표 작성예시 2023 2", url: "https://docs.google.com/uc?export=download&id=1V2nYGaOdYKyeAqYDzL602ULIHCu5hoIl&confirm=t" },
    ]},
    { name: "감사/검토조서서식(법인)", links: [
      { label: "AP1 전문가 질문서 2023", url: "https://docs.google.com/uc?export=download&id=1fE6lYsTbr4bwRFgHcyirLx4NtioRWmB6&confirm=t" },
      { label: "AP2 재발행·정정공시 발행승인요청서 2023", url: "https://docs.google.com/uc?export=download&id=1myBLSy_-lytBmserue5K-O_6vaqfh36M&confirm=t" },
      { label: "AP3 감사전 재무제표 확인절차 2023", url: "https://docs.google.com/uc?export=download&id=1TYE-ElkVlZ8f1KCIGMLenBbs80ZkS5S9&confirm=t" },
      { label: "AP7 감사정보 폐기 서약서 2023", url: "https://docs.google.com/uc?export=download&id=108tD13TFXO2ApSaZBvx246xUGVmXhdLT&confirm=t" },
      { label: "AP8 분반기검토 일반조서 2023", url: "https://docs.google.com/uc?export=download&id=1GlAlgspnDhUkii3fI9WkezPQJpywH_Om&confirm=t" },
      { label: "AP9 자문요청서 2023", url: "https://docs.google.com/uc?export=download&id=18sTpvUv1dRTDPcNrV_gqta8tgNJD0tv-&confirm=t" },
    ]},
    { name: "사전심리", links: [{ label: "8550-CL 심리체크리스트 2023 1", url: "https://docs.google.com/uc?export=download&id=1saHq_Yv8xxZy87xN8WcYkhPDhIcO08Ar&confirm=t" }]},
  ]},
];

export default function PortalFormsPage() {
  const [activeTab, setActiveTab] = useState("forms");

  const jotformTabs = tabs.filter((t) => t.jotform);
  const activeJotform = jotformTabs.find((t) => t.id === activeTab)?.jotform;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Forms and Templates</h1>

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

      {activeTab === "forms" && (
        <div className="space-y-6 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold">절차별 내부서식</h2>
          {formLinks.map((cat) => (
            <div key={cat.category} className="space-y-3">
              <h3 className="font-medium">{cat.category}</h3>
              <ul className="list-inside space-y-2 text-sm">
                {cat.items.map((item) => (
                  <li key={item.name}>
                    <span className="text-foreground">{item.name}</span>
                    <ul className="ml-4 mt-1 space-y-1">
                      {item.links.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {link.label} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeJotform && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <iframe
            title="JotForm"
            src={`https://form.jotform.com/${activeJotform}?isIframeEmbed=1`}
            frameBorder="0"
            className="min-h-[600px] w-full"
            allowFullScreen
          />
        </div>
      )}

      {activeTab === "online" && (
        <p className="text-gray-500">온라인 접수 서식은 위 탭에서 선택해 주세요.</p>
      )}
    </div>
  );
}
