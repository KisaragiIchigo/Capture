@echo off
chcp 932 > nul
cd /d "%~dp0"
title Capture - 開発モード

rem VSCode のターミナル配下では ELECTRON_RUN_AS_NODE が継承されており、
rem そのままだと Electron が素の Node として起動して落ちる。ここで必ず消す。
set "ELECTRON_RUN_AS_NODE="

if not exist "node_modules\" (
  echo.
  echo   依存パッケージが見つかりません。
  echo   先に セットアップ.bat を実行してください。
  echo.
  pause
  exit /b 1
)

call npm run dev
if errorlevel 1 (
  echo.
  echo   起動に失敗しました。上のメッセージをご確認ください。
  pause
)
exit /b 0
