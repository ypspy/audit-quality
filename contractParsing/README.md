# Contract Parsing (감사보고서·계약체결보고 파싱)

DART 접수 감사보고서 및 감사계약체결보고 HTML에서 구조화된 정보를 추출하는 Python 도구 모음입니다.

## 개요

- **압축 해제**: 감사보고서 압축 파일 내 중첩 zip 추출 및 한글 파일명 처리
- **형식 변환**: DSD 파일을 HTML로 변환 (자동화 스크립트)
- **외부감사 실시내용**: HTML의 "외부감사 실시내용" 테이블 파싱 → 투입 인원수, 분·반기검토, 감사, 합계 등 요약
- **감사계약체결보고**: 2019년 이후 서식에서 감사인/감사대상회사/감사계약/보고자 등 정보 추출

## 폴더 구조

```
contractParsing/
├── documents/          # DART에서 받은 문서 (폴더별 문서 ID, summaryinfo.xml 등)
├── html/               # 변환된 HTML 파일 (*.htm)
├── unzipSubfolder.py   # 중첩 zip 추출
├── dart_to_HTML.py     # DSD → HTML 변환 (자동화)
├── AL_HTML_Time.py     # 외부감사 실시내용 파싱
├── HTML_to_Table.py    # 감사계약체결보고 파싱
├── document_summary.txt   # AL_HTML_Time.py 출력
├── document_id.txt        # AL_HTML_Time.py 출력 (문서 식별 정보)
└── result.txt             # HTML_to_Table.py 출력
```

## 요구 사항

- **Python**: 3.x
- **패키지**: `beautifulsoup4`, `lxml`, `pandas`, `pyautogui`  
  (`dart_to_HTML.py`만 `pyautogui` 사용, 나머지는 BeautifulSoup·pandas 등)

설치 예:

```bash
pip install beautifulsoup4 lxml pandas pyautogui
```

## 사용 순서

1. **압축 해제**  
   `documents/` 아래에 DART에서 받은 폴더를 넣은 뒤 실행:
   ```bash
   python unzipSubfolder.py
   ```
   - 폴더 내 `*.zip`을 찾아 압축 해제 후 zip 파일 삭제
   - 한글 파일명 깨짐 방지 처리 포함 (cp437 → euc-kr)

2. **DSD → HTML 변환** (선택)  
   ```bash
   python dart_to_HTML.py
   ```
   - `documents/` 내 `**/*.dsd` 파일을 열고, 브라우저/저장 경로를 자동 조작해 HTML로 저장
   - **주의**: `pyautogui`로 화면을 제어하므로 실행 중 다른 조작을 하면 안 됨.  
     저장 경로(`pathDoc`, 저장 위치)는 환경에 맞게 수정 필요.

3. **외부감사 실시내용 추출**  
   ```bash
   python AL_HTML_Time.py
   ```
   - 입력: `./html/*.htm`
   - 출력: `document_summary.txt`, `document_id.txt`
   - "외부감사 실시내용을" 이후 테이블에서 투입 인원수, 분·반기검토, 감사, 합계 등 추출

4. **감사계약체결보고 추출**  
   ```bash
   python HTML_to_Table.py
   ```
   - 입력: `./html/*.htm`
   - 출력: `result.txt`
   - "감사계약체결보고" 이후 테이블에서 감사인 개황, 감사대상회사 개황, 감사계약 내용, 보고자 등 추출 (외감법 개정 후 감독원 요구 정보 반영)

## 출력 파일 설명

| 파일 | 생성 스크립트 | 내용 |
|------|----------------|------|
| `document_summary.txt` | AL_HTML_Time.py | 파일경로_구분(투입인원수/분·반기검토/감사/합계)_세부항목_수치 |
| `document_id.txt` | AL_HTML_Time.py | 파일별 식별 정보 (정정 여부, 당기/전기 등) |
| `result.txt` | HTML_to_Table.py | 감사계약체결보고 서식별 필드가 `_`로 구분된 한 줄 요약 |

## 참고

- **AL_HTML_Time.py**: 당기/전기 표시가 없는 HTML도 처리하도록 인덱싱 로직 포함.
- **dart_to_HTML.py**: DSD 뷰어 실행 및 "한/영 전환 한글('가')", "크롬 저장 1회" 등 사전 설정이 필요할 수 있음.  
  저장 경로는 `pathDoc`, 저장 대상 폴더 등이 하드코딩되어 있어 PC별로 수정이 필요할 수 있습니다.
- **HTML_to_Table.py**: 2019년 이후 감사계약체결보고 서식 기준 (테이블 인덱스 1~5 사용).

## 라이선스

프로젝트 정책에 따릅니다.
