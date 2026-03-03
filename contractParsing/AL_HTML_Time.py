  
"""
Created on Thu Aug 13 15:19:08 2020

@author: user

보관중인 HTML에서 외부감사실시내용을 분리하고, 분리된 정보를 요약하는
코드.

"""
from bs4 import BeautifulSoup
import os
import glob
import pandas as pd

def col_span_count(soup):
    try:
        result = int(soup["colspan"])
    except KeyError:
        result= 1
    return result

def row_span_count(soup):
    try:
        result = int(soup["rowspan"])
    except KeyError:
        result= 1
    return result

def FindTargetTable(soup):
    tables = soup.find_all("table")
    for i in tables:
        tds = i.find_all("td")
        if len(tds) > 20:  # 시간 파트가 약 80정도 된다. 비교 표시 없는 경우 td가 50도 안된다. 첫번째 나오는 20 초과 table 선택
            break
    return i
    
def MatrixGenerator(table):
    table_row = table.find_all("tr")

    columnCount = 0
    for i in table_row:
        columnNumber = 0
        for j in i.find_all(["th", "td"]):
            try:
                columnNumber += int(j["colspan"])
            except KeyError:
                columnNumber += 1
            if columnNumber > columnCount:
                columnCount = columnNumber        
    rowCount = len(table_row)
    matrix = [['#' for x in range(columnCount)] for y in range(rowCount)] 
    for i in range(len(table_row)):
        locator = [i for i, x in enumerate(matrix[i]) if x=='#']  # https://stackoverflow.com/questions/9542738/python-find-in-list
        column, colSpan = 0, 0
        for j in table_row[i].find_all(["th", "td"]):
            rowSpanCount = row_span_count(j)
            colSpanCount = col_span_count(j)

            for k in range(rowSpanCount):
                for l in range(colSpanCount):
                    row = i + k
                    column = locator[l+colSpan]
                    matrix[row][column] = j.text.strip()
            colSpan += col_span_count(j)
    return matrix

def ParsingTime(matrix, isComparative, tableLength, file, report):
    if isComparative:
        container = []
        tableLength = int(tableLength / 2)
        for i in range(tableLength):
            container.append(file + "_" + matrix[report][1] + "_" + matrix[1][2+2*i] + "_" + matrix[report][2+2*i].replace('-', '0').replace(',','') + "\n")
    else:
        container = []
        tableLength = int(tableLength)
        for i in range(tableLength):
            container(file + "_" + matrix[report][1] + "_" + matrix[1][2+i] + "_" + matrix[report][2+i].replace('-', '0').replace(',','') + "\n")
    return container

def Indexing(matrix):
    """
    당기, 전기 부분 삭제한 경우들이 있어서 찾아야함
    """
    container = []
    for i in matrix:
        try:
            i[0:2].index("투입 인원수")
            container.append(matrix.index(i))
        except ValueError:
            pass
        try:
            i[0:2].index("분ㆍ반기검토")
            container.append(matrix.index(i))
        except ValueError:
            pass
        try:
            i[0:2].index("감사")
            container.append(matrix.index(i))
        except ValueError:
            pass
        try:
            i[0:2].index("합계")
            container.append(matrix.index(i))
        except ValueError:
            pass
    return container

txtName = os.path.join("./", "document_summary.txt")
result = open(txtName, 'w', encoding="utf-8")

txtName = os.path.join(".\\", "document_id.txt")
result2 = open(txtName, 'w', encoding="utf-8")

# 2. 타겟 폴더에 있는 필요 문서 경로 리스트업
pathList = glob.glob('./html/*.htm')

PathListDf = pd.DataFrame(pathList)
df = pd.DataFrame([x.split("_") for x in pathList])

df["path"] = PathListDf[0]

pathListOut = df["path"].tolist()

for file in pathListOut:

    html = open(file, "r", encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    html.close()
    
    amend = str(soup).count("정 정 신 고 (보고)")
    
    if amend:
        amend = "정정"
    else:
        amend = '-'
    
    soupList = str(soup).split("외부감사 실시내용을")
    soup = BeautifulSoup(soupList[len(soupList)-1].replace("\n", '').replace("\xa0", ''), "lxml")
    
    table = FindTargetTable(soup)
    
    matrix = MatrixGenerator(table)
    isComparative = matrix[1][2] == matrix[1][3]
    tableLength = len(matrix[1]) - 2
    
    container = Indexing(matrix)
    
    identity = file + '_' + MatrixGenerator(soup.table)[0][1] + "_" + str(amend) + "_" + MatrixGenerator(soup.table)[1][1] + "_" + MatrixGenerator(soup.table)[1][3] + "\n"
       
    result2.write(identity)
    
    for j in container:
        returnList = ParsingTime(matrix, isComparative, tableLength, file, j)
        for k in returnList:
            result.write(k)

result.close()
result2.close()
