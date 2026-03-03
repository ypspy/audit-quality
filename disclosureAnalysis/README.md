# Disclosure Analysis (공시 분석)

감사보고서 HTML 파일에서 **감사보고일(audit report date)** 및 관련 날짜를 추출하는 Python 스크립트입니다.  
연결/별도 재무제표 감사보고서를 대상으로 12월 결산 자료만 선별해 일자 정보를 수집합니다.

---

## 프로젝트 구조

```
disclosureAnalysis/
├── README.md
├── reportDate.py              # 감사보고일 추출 메인 스크립트
├── auditReportDate_listed.txt       # 추출 결과 (연결 감사보고서 등)
└── auditReportDate_listed_sep.txt  # 추출 결과 (별도 감사보고서 등)
```

---

## 기능 요약

- **입력**: `C:\data\` 하위의 연도별 폴더(`A001_2016`, `A001_2017`, …)에 있는 감사보고서 HTML
- **대상 파일**:  
  - `* 감사보고서*감사인의감사보고서*.*`  
  - `* 연결감사보고서*감사인의감사보고서*.*`
- **필터**:  
  - 파일명에 `duplicated` 포함 시 제외  
  - **12월 결산**만 사용 (경로에 `.12)` 포함)
- **처리**:  
  - HTML 파싱(BeautifulSoup) 후 본문에서 `YYYY년M월D일` 형식 날짜 정규식 추출  
  - 경로/파일명으로 고유 키 생성 후 중복 제거, 정렬  
  - 회사명·종목코드·결산기·추출된 날짜들을 CSV로 저장

---

## 환경 설정

### Python 버전

- Python 3.x 권장

### 패키지 설치

```bash
pip install beautifulsoup4 lxml pandas numpy tqdm
```

| 패키지 | 용도 |
|--------|------|
| beautifulsoup4 | HTML 파싱 |
| lxml | BeautifulSoup 파서 |
| pandas | 데이터프레임 및 CSV 처리 |
| numpy | 배열/논리 연산 |
| tqdm | 진행률 표시 |

---

## 사용 방법

1. **데이터 경로 설정**  
   `reportDate.py` 상단에서 다음 두 경로를 사용 환경에 맞게 수정합니다.

   ```python
   os.chdir("C:\data\\")   # 감사보고서 HTML이 있는 작업 폴더
   # ...
   os.chdir(r"C:/Users/yoont/Documents/disclosureAnalysis/")  # 결과 CSV 저장 경로
   ```

2. **연도/폴더 확인**  
   스크립트는 `.\A001_2016\`, `.\A001_2017\`, … `.\A001_2020\` 를 순회합니다.  
   필요 시 해당 리스트를 추가·수정합니다.

3. **실행**

   ```bash
   python reportDate.py
   ```

4. **결과 파일**  
   설정한 출력 디렉터리(예: `disclosureAnalysis/`)에 아래 파일이 생성됩니다.  
   - `auditReportDate_listed_sep.txt`  
   컬럼: `key`, 회사명(3), 종목코드(10), 결산기(5), `auditReportDate`(추출된 날짜 문자열, `_` 구분)

---

## 출력 데이터 설명

| 컬럼 | 설명 |
|------|------|
| key | 경로/파일명 기반 고유 키 (연결(C)/별도(S), 정정(A)/최초(B) 등 반영) |
| 3 | 회사명 |
| 10 | 종목/식별 코드 (예: 110111-0000086) |
| 5 | 결산기 (예: (2015.12)) |
| auditReportDate | 본문에서 추출한 날짜들 (예: `2016년3월9일_2015년12월31일_…`) |

---

## 참고

- 스크립트 내 데이터 경로(`C:\data\`, 출력 경로)는 예시이므로, 실행 환경에 맞게 반드시 수정해야 합니다.
- 중복 제거·정렬·결산기 필터 등은 감사연구(audit-quality) 목적에 맞게 조정된 로직입니다.
