@echo off
chcp 65001 >nul
title Expo 로그인
cd /d "%~dp0"
echo.
echo  🌸 Expo 계정으로 로그인합니다.
echo  가입할 때 쓴 이메일과 비밀번호를 입력하세요.
echo  (비밀번호는 입력해도 화면에 안 보이는 게 정상이에요!)
echo.
call npx.cmd expo login
echo.
echo  로그인 상태 확인:
call npx.cmd expo whoami
pause
