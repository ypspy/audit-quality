
# -*- coding: utf-8 -*-
"""
Created on Thu Aug 13 15:19:08 2020

감사보고서 DSD를 HTML로 변환하는 코드. XML에 포함된 정보를 분류 정보로 사용함.

준비) 1. 한/영 전환을 한글상태 '가'로 변경 2. 크롬 저장을 목적지로 1회 수

@author: user

https://wotres.tistory.com/entry/python-%EC%97%90%EC%84%9C-SyntaxError-unicode-error-unicodeescape-codec-cant-decode-bytes-in-position-2-3-truncated-UXXXXXXXX-escape-%EC%97%90%EB%9F%AC-%ED%95%B4%EA%B2%B0%EB%B2%95

"""
import os
import glob
import time
import pyautogui


def mouse_click(x, y):
    pyautogui.moveTo(x, y)
    pyautogui.click()
    time.sleep(0.5)

# 1. 작업 폴더로 변경
os.chdir(r"./documents/")  # 작업 폴더로 변경o

# 2. 타겟 폴더에 있는 필요 문서 경로 리스트업
pathList = glob.glob('**/*.dsd')
resultPath = "./html/"

for path in pathList:
    
    os.startfile(path)

    time.sleep(4)
    pyautogui.hotkey('alt', 'n')
    pyautogui.press('enter', presses=1)
    
    pyautogui.press('esc', presses=3)

    time.sleep(2)
    pyautogui.hotkey('ctrl', 'w')
    time.sleep(2)
    pyautogui.hotkey('ctrl', 't')
    
    time.sleep(2)
    pathDoc = "file:///C:/Users/yoont/AppData/Local/Temp/~$DartHTML-DOC.htm"
    pyautogui.write(pathDoc)
    
    time.sleep(2)
    pyautogui.press('enter', presses=1)
    
    time.sleep(2)
    pyautogui.hotkey('ctrl', 's')
    
    time.sleep(3)
    pyautogui.write(path.split("\\")[0])
    
    time.sleep(2)
    pyautogui.press('enter', presses=1)

    time.sleep(2)
    pyautogui.hotkey('ctrl', 'f4')
    
    time.sleep(1)
    pyautogui.hotkey('ctrl', 'f4')
    
    time.sleep(1)
    pyautogui.hotkey('alt', 'tab')
    
    time.sleep(1)
    pyautogui.hotkey('ctrl', 'f4')
       