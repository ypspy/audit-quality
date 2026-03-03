import Link from "next/link";

const notices = [
  { date: "2023-10-31", text: "거래금지주식 정보를 업데이트하였습니다." },
  {
    date: "2023-08-17",
    text: "서식 페이지의 '2700A 중요성 요약표 작성예시 2023 2' 사용 부탁드립니다. 표준중요성 산출식의 오류를 수정하였습니다.",
  },
  {
    date: "2023-07-27",
    text: "현행 내규 게시 장소를 정책과 절차 페이지로 이관하였습니다. 현행 내규는 대표이사의 결정에 따라 기존 내규가 규율하는 바를 유지하며, 통일성 가독성 등을 개선하기 위하여 형식을 정비한 결과입니다.",
  },
  {
    date: "2023-07-17",
    text: "거래금지주식 정보를 업데이트하였습니다. 추가로 여신금융기관(*)과 대부업 수임내역을 공지합니다. 독립성 유지에 참고 바랍니다.",
    note: "(*) 법령에 따라 인가 또는 허가 등을 받아 대부업을 하는 「은행법」의 은행, 「상호저축은행법」의 상호저축은행, 「신용협동조합법」의 신용협동조합, 「여신전문금융업법」의 신용카드업자, 시설대여업자, 할부금융업자, 신기술사업금융업자, 「보험업법」의 보험회사를 의미함",
  },
  { date: "2023-02-15", text: "거래금지주식 정보 제공합니다." },
  {
    date: "2023-01-19",
    text: "정책과 절차 페이지 링크 — Navigation Tab을 정리하였습니다. '정책과 절차'를 클릭하면 해당 페이지로 이동합니다.",
  },
  {
    date: "2022-12-20",
    text: "QC Portal을 이관·개편 — Forms and Templates와 VSC만 사용할 수 있습니다.",
  },
];

const prohibitedStocks = [
  { company: "엔터파트너즈 (구 (주)일야)", code: "058450", contractDate: "2022년 11월 25일", listingDate: "2002년 1월 17일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "제일전기공업(주)", code: "199820", contractDate: "2023년 2월 14일", listingDate: "2020년 11월 26일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "동일산업 주식회사", code: "004890", contractDate: "2023년 2월 14일", listingDate: "2005년 6월 30일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "대주전자재료 주식회사", code: "078600", contractDate: "2022년 11월 29일", listingDate: "2004년 12월 10일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "주식회사 드래곤플라이", code: "030350", contractDate: "2022년 11월 25일", listingDate: "1997년 11월 10일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "주식회사 캐스텍코리아", code: "071850", contractDate: "2022년 11월 25일", listingDate: "2014년 05월 27일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "한국컴퓨터(주)", code: "054040", contractDate: "2022년 11월 24일", listingDate: "2002년 1월 15일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "에스지에이 주식회사", code: "049470", contractDate: "2022년 11월 24일", listingDate: "2001년 10월 11일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "주식회사 룽투코리아", code: "060240", contractDate: "2023년 2월 14일", listingDate: "2002년 1월 4일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "주식회사 한컴라이프케어", code: "372910", contractDate: "2023년 2월 14일", listingDate: "2021년 8월 17일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "㈜라온테크", code: "232680", contractDate: "2023년 2월 14일", listingDate: "2021년 6월 17일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "에스지에이솔루션즈 주식회사", code: "184230", contractDate: "2022년 11월 25일", listingDate: "2013년 12월 20일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "비씨엔씨 주식회사", code: "146320", contractDate: "2023년 2월 14일", listingDate: "2022년 3월 3일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "(주)모코엠시스", code: "333050", contractDate: "2023년 1월 16일", listingDate: "2019년 10월 31일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "한화플러스제2호 기업인수목적 주식회사", code: "386580", contractDate: "2023년 2월 14일", listingDate: "2021년 8월 5일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "한화플러스제3호 기업인수목적 주식회사", code: "430460", contractDate: "2023년 2월 14일", listingDate: "2022년 9월 29일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "키움제8호 기업인수목적 주식회사", code: "446840", contractDate: "2023년 1월 17일", listingDate: "2022년 5월 17일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "한화플러스제4호 기업인수목적 주식회사", code: "455310", contractDate: "2023년 4월 9일", listingDate: "2023년 9월 7일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
];

const lenders = [
  { company: "드림저축은행", id: "00106784", contractDate: "2022년 10월 31일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "부림저축은행", id: "00123879", contractDate: "2022년 11월 25일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "삼정저축은행", id: "00128166", contractDate: "2022년 11월 25일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "오성저축은행", id: "00141750", contractDate: "2023년 2월 14일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "동양저축은행", id: "00172893", contractDate: "2023년 2월 14일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "나라대부금융", id: "00916969", contractDate: "2023년 4월 30일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
  { company: "코리아인베스트먼트대부", id: "01735680", contractDate: "2023년 4월 30일", period: "2023년 1월 1일부터 2023년 12월 31일까지" },
];

const naverStockUrl = (code: string) =>
  `https://finance.naver.com/item/main.naver?code=${code}`;

export default function PortalHomePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">선진회계법인 Quality Portal</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold">공지사항</h2>
          <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            {notices.map((n, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">({n.date})</span> {n.text}
                {n.note && (
                  <span className="mt-1 block text-xs text-gray-500">{n.note}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">거래금지주식 내역</h2>
          <p className="mb-3 text-sm text-gray-500">업데이트일: 2023-10-31</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">회사명</th>
                  <th className="p-2 text-left">종목코드</th>
                  <th className="p-2 text-left">계약일/상장일</th>
                  <th className="p-2 text-left">대상기간</th>
                </tr>
              </thead>
              <tbody>
                {prohibitedStocks.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{s.company}</td>
                    <td className="p-2">
                      <a
                        href={naverStockUrl(s.code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {s.code}
                      </a>
                    </td>
                    <td className="p-2">
                      {s.contractDate}
                      <br />
                      <small className="text-gray-500">{s.listingDate}</small>
                    </td>
                    <td className="p-2">{s.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-6 mb-4 text-lg font-semibold">여신금융기관과 대부업자</h2>
          <p className="mb-3 text-sm text-gray-500">업데이트일: 2023-07-17</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">회사명</th>
                  <th className="p-2 text-left">고유번호</th>
                  <th className="p-2 text-left">계약일</th>
                  <th className="p-2 text-left">대상기간</th>
                </tr>
              </thead>
              <tbody>
                {lenders.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{s.company}</td>
                    <td className="p-2">{s.id}</td>
                    <td className="p-2">{s.contractDate}</td>
                    <td className="p-2">{s.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
