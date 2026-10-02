@echo off
chcp 65001 >nul
title 베롱이 서버
cd /d "%~dp0"
echo.
echo  🌸 베롱이를 시작합니다...
echo  QR 코드가 뜨면 아이폰 카메라로 스캔하세요! (같은 와이파이 필수)
echo  끄려면 이 창에서 Ctrl+C 또는 창 닫기
echo.
call npx.cmd expo start
pause
