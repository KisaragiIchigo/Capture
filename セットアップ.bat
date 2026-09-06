@echo off
chcp 932 > nul
cd /d "%~dp0"
title Capture - セットアップ
set "ELECTRON_RUN_AS_NODE="

echo.
echo   依存パッケージをインストールします。
echo.
call npm install
if errorlevel 1 goto :error

echo.
echo   セットアップが完了しました。起動.bat から起動できます。
echo.
echo   キャプチャーエンジンはアプリの初回起動時に自動で取得します。
echo   コマンドでの操作は不要です。
echo.
pause
exit /b 0

:error
echo.
echo   セットアップに失敗しました。上のメッセージをご確認ください。
echo.
pause
exit /b 1
