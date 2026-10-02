@echo off
chcp 65001 >nul
title 베롱이 서버 (터널 모드)
cd /d "%~dp0"
echo.
echo  🌸 베롱이를 터널 모드로 시작합니다...
echo  와이파이가 달라도, 아이폰이 LTE여도 연결됩니다!
echo  (처음엔 준비에 1~2분 걸릴 수 있어요)
echo  QR 코드가 뜨면 아이폰 카메라로 스캔하세요.
echo.
call npx.cmd expo start --tunnel
pause
