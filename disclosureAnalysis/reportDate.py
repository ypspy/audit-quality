# -*- coding: utf-8 -*-
"""
Created on Thu Aug 13 15:19:08 2020

@author: user
"""

from bs4 import BeautifulSoup
import os
import glob
import pandas as pd
import numpy as np
from tqdm import tqdm
import re
import time

try:
    # OpenTelemetry 설정 (있을 때만 활성화)
    from opentelemetry import metrics, trace
    from opentelemetry.trace import Status, StatusCode
    import otel_setup  # noqa: F401

    _tracer = trace.get_tracer(__name__)
    _meter = metrics.get_meter(__name__)
except Exception:
    trace = None  # type: ignore[assignment]
    metrics = None  # type: ignore[assignment]
    Status = StatusCode = None  # type: ignore[assignment]
    _tracer = None
    _meter = None

# 1. 작업 폴더 (입력 루트) 설정 — 환경변수로 오버라이드 가능
INPUT_ROOT = os.getenv("DISCLOSURE_INPUT_DIR", r"C:\data")
OUTPUT_ROOT = os.getenv(
    "DISCLOSURE_OUTPUT_DIR", r"C:/Users/yoont/Documents/disclosureAnalysis/"
)

# OTEL용 실행 메트릭 초기화
_run_span = None
_run_start = time.time()
if _tracer is not None:
    _run_span = _tracer.start_span("disclosure_analysis.run")

# 입력 데이터가 있는 루트로 이동
os.chdir(INPUT_ROOT)  # 작업 폴더로 변경

# 2. 타겟 폴더에 있는 필요 문서 경로 리스트업
pathList = []
year_paths = [
    os.path.join(".", "A001_2016"),
    os.path.join(".", "A001_2017"),
    os.path.join(".", "A001_2018"),
    os.path.join(".", "A001_2019"),
    os.path.join(".", "A001_2020"),
]
for path in tqdm(year_paths):
    # 필요한 Keyword 입력
    path1 = os.path.join(path, "* 감사보고서*감사인의감사보고서*.*")
    pathSep = glob.glob(path1)
    path2 = os.path.join(path, "* 연결감사보고서*감사인의감사보고서*.*")
    pathCon = glob.glob(path2)

    pathList = pathList + pathSep + pathCon

# 3. 입수 과정에서 중복입수되어 표시된 duplicated 표시 파일 제거
pathList = [x for x in pathList if "duplicated" not in x]

# 4. 12월말만 분리
pathList = [x for x in pathList if ".12)" in x]

# 입수 data의 PathList 정보로 Tabulate
PathListDf = pd.DataFrame(pathList)
df = pd.DataFrame([x.split("_") for x in pathList])

# Generate Unique Key
df["path"] = PathListDf[0]
df["con"] = df[6].str.contains("연결")
df['con'] = np.where(df['con']==True, "C", "S")
df['amend'] = df[6].str.contains("정정")
df['amend'] = np.where(df['amend']==True, "A", "B")
df["key"] = df[2] + df[6].str.slice(stop=10) + df["con"] \
          + df["amend"] + df[5] + df[8] + df[10]

# sort by Entity
df = df.sort_values(by=[10, 5, "con", 2, 6, "amend", 7],  
                    ascending=[True, True, 
                               False,  # 별도에서 추출
                               False, 
                               True, # 가설에 따라 조정
                               True, False])  

# Remove duplicates
df["duplc"] = df.duplicated(subset=["key"], keep=False)
isTrue = df[df["duplc"] == True]
df = df.drop_duplicates(subset=["key"])

df = df.drop([0, 1, 14, "duplc"], axis=1)

df["toDrop"] = 1
for i in range(1, len(df)):
    if df.iloc[i,3] == df.iloc[i-1,3] and df.iloc[i,8] == df.iloc[i-1,8]:
        df.iloc[i, 16] = df.iloc[i-1, 16] + 1
    else:
        df.iloc[i, 16] = 1
df = df[df["toDrop"] == 1]
df = df.drop("toDrop", axis=1)

# Path out
pathListOut = df["path"].tolist()

p = re.compile("[0-9]{4}년[0-9]{1,2}월[0-9]{1,2}일")
result = []

for file in tqdm(pathListOut, desc="Main Loop"):

    html = open(file, "r", encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    html.close()
    
    # 분석
    content = ''.join(soup.text.split())
    firstPart = content.split("의견근거")[0]
    secondPart = content.split("재무제표에대한경")
    secondPart = secondPart[len(secondPart) - 1]
    content = firstPart + secondPart

    output = set(p.findall(content))
    
    resultString = ''
    
    for i in output:
        resultString = resultString + i + "_"
    
    result.append(resultString)

df["auditReportDate"] = result
df2 = df[["key", 3, 10, 5, "auditReportDate"]]

# 출력 디렉터리로 이동 (컨테이너/로컬 모두 지원)
os.makedirs(OUTPUT_ROOT, exist_ok=True)
os.chdir(OUTPUT_ROOT)
df2.to_csv("auditReportDate_listed_sep.txt")

# OTEL 메트릭/스팬 기록
if _run_span is not None:
    try:
        _run_span.set_attribute("disclosure_analysis.input_root", INPUT_ROOT)
        _run_span.set_attribute("disclosure_analysis.output_root", OUTPUT_ROOT)
        _run_span.set_attribute("disclosure_analysis.files.count", len(pathList))
        duration = time.time() - _run_start

        if _meter is not None:
            try:
                duration_hist = _meter.create_histogram(
                    "disclosure_analysis.duration.seconds"
                )
                duration_hist.record(duration)
            except Exception:
                # 메트릭 전송 실패는 배치 자체에는 영향을 주지 않는다.
                pass

        if Status is not None and StatusCode is not None:
            _run_span.set_status(Status(StatusCode.OK))  # type: ignore[call-arg]
    finally:
        _run_span.end()

