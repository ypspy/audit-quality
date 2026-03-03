"use client";

import { useState } from "react";

const tabs = [
  { id: "survey", label: "VSC 수요조사", jotform: "220091436987462" },
  { id: "review", label: "감사인 검토사항 제출 서식", jotform: "213498496859075" },
];

export default function PortalVSCPage() {
  const [activeTab, setActiveTab] = useState("survey");
  const activeJotform = tabs.find((t) => t.id === activeTab)?.jotform;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">평가전문가부서(VSC) 의뢰</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          2022년 기말감사시 VSC를 활용하려는 팀에서는 우측 서식에 따라 2023년 1월 10일(화)까지 요청 부탁드립니다.
        </p>
        <p className="text-sm text-gray-500">
          Busy season의 경우 업무가 집중되는 경향이 있으므로 동 수요조사 기한 내에 참여해주신 감사팀을 우선순위로 하여 업무를 진행할 계획입니다.
        </p>

        <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <h3 className="font-semibold">VSC 담당인원</h3>
            <p className="text-sm">정영훈CPA / 김한준CPA</p>
            <p className="mt-1 text-sm text-gray-500">
              삼일회계법인에서 평가관련 10년 이상의 경력을 갖고 있으며, 2020년 기말 관련 한영회계법인으로부터 VSC 관련 외주 업무를 진행하였으며, 2021년부터 VSC 업무를 수행하고 있습니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">VSC 업무 범위</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              업무단위는 평가 대상 &quot;보고서&quot;에 대한 리뷰를 기본 단위로 합니다. 대상 보고서 내용에 국한하여 일정한 양식에 따른 리뷰를 수행하며, 해당 리뷰를 위한 자료 요청/수령이나 리뷰에 대한 follow-up feedback, 관련 회계처리 검토 등 전반적인 감사업무는 당연히 감사팀 계정담당자의 업무입니다.
            </p>
            <a
              href="https://docs.google.com/uc?export=download&id=1LJjp2_to80URPmHDlSY3dScnMyaM01JE&confirm=t"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              VSC업무범위 다운로드 ↗
            </a>
          </div>
          <div>
            <h3 className="font-semibold">VSC 진행 프로세스</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-gray-600 dark:text-gray-400">
              <li>감사팀은 우측 서식에 따라 VSC 수요 조사에서 평가 의뢰 (기한: 23년 1월 10일)</li>
              <li>감사팀은 엑셀서식을 참고하여 감사인검토사항 작성, 회사로부터 수령한 평가보고서와 함께 자료 접수</li>
              <li>VSC에서 누락된 자료가 없는지 확인 후 검토 시작</li>
              <li>VSC는 Q&A를 감사팀을 통해 수행 (통상 2~3주)</li>
              <li>검토완료 후 VSC가 검토 조서를 감사팀 담당자에게 전달</li>
              <li>감사팀은 reviewer의 주요 발견사항을 검토하고 중요성을 고려하여 accept/reject 결정</li>
            </ol>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex gap-2">
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
              title="VSC JotForm"
              src={`https://form.jotform.com/${activeJotform}?isIframeEmbed=1`}
              frameBorder="0"
              className="min-h-[500px] w-full"
              allowFullScreen
            />
          </div>
        )}
      </div>
    </div>
  );
}
