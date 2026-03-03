# -*- coding: utf-8 -*-
"""
Created on Fri Jan 22 16:26:48 2021

@author: yoonseok

DART 접수 시스템에 접수된 감사보고서에서 압축파일 안에 압축파일이
있는 경우 압축폴더 안에 있는 압축폴더를 모두 추출하고 zip 파일을
삭제하는 코드

1. zipFile 파일명 깨짐 해결
https://gldmg.tistory.com/141

"""

import os
import glob
import zipfile

# 2. 타겟 폴더에 있는 필요 문서 경로 리스트업
directory_to_extract_to = glob.glob('./documents/*/')

for i in directory_to_extract_to:
    path = glob.glob(i + '\\*.zip')
    if path:
        for j in path:
            with zipfile.ZipFile(j, 'r') as f:
                zipInfo = f.infolist()
                for member in zipInfo:
                    member.filename = member.filename.encode('cp437').decode('euc-kr', 'ignore')
                    f.extract(member, i)
            os.remove(j)
