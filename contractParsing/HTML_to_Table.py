# -*- coding: utf-8 -*-
"""
Created on Wed Sep 16 14:47:34 2020

@author: user

감사계약체결보고 2019년 이후 서식에서 정보 입수.
외감법 개정으로 감독원 요구 정보가 변함.

1. 폴더에서 파일 찾기
https://stackoverflow.com/questions/10377998/how-can-i-iterate-over-files-in-a-given-directory

"""

from bs4 import BeautifulSoup
import glob

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

def matrix_generator(soup, tableNo):
    table = soup.find_all("table")[tableNo]
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

result = open("result.txt", 'w', encoding="utf-8")

# 2. 타겟 폴더에 있는 필요 문서 경로 리스트업
pathList = glob.glob('./html/*.htm')

for path in pathList:

    html = open(path, "r", encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    html.close()

    soup1 = str(soup)
    soup = str(soup1).split(">감사계약체결보고")[1]
    soup2 = str(soup)
    soup = soup.replace("\n", '')
    soup = BeautifulSoup(soup, "lxml")   

    indexRatio = len(soup1)/len(soup2)

    string = path.split("-")[0] + "_"

    if indexRatio > 1.5:
        string = string + "정정_"
    else:
        string = string + "_"

    table1 = matrix_generator(soup, 1)  # 1 감사인 개황
    table2 = matrix_generator(soup, 2)  # 2 감사대상회사 개황
    table3 = matrix_generator(soup, 3)  # 3 감사계약 내용
    table4 = matrix_generator(soup, 4)  # 4 보고자
    table5 = matrix_generator(soup, 5)  # 5 감사계약서 첨부

    for i in range(len(table1)):
        string = string + table1[i][1] + "_"

    for i in range(len(table2)):
        if i == 17:  # 결산기 변경내용
            string = string + table2[i][2] + "_"
            string = string + table2[i][4] + "_"
        elif i == 23:  # 정기주주총회 개최시기
            string = string + table2[i][5] + "_"
        elif i == 26:
            None
        elif i == 27:  # 과거 6개연도 현황
            string = string + table2[i][2] + "_"
            string = string + table2[i][3] + "_"
            string = string + table2[i][4] + "_"
            string = string + table2[i][5] + "_"
            string = string + table2[i][6] + "_"
            string = string + table2[i][7] + "_"
        else:
            string = string + table2[i][2] + "_"

    for i in range(len(table3)):
        if i == 6:  # 감사대상 사업연도
            string = string + table3[i][2] + "_"
            string = string + table3[i][4] + "_"
            string = string + table3[i][6] + "_"
            string = string + table3[i][8] + "_"
        else:
            string = string + table3[i][1] + "_"

    string = string + table4[0][2] + '_' + table4[0][4] + '_' + table4[0][6] + '_' + table4[1][1] + '_'

    string = string + table5[0][1] + "\n"

    result.write(string)

result.close()