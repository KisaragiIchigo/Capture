@echo off
chcp 932 > nul
cd /d "%~dp0"
title Capture - ビルド
set "ELECTRON_RUN_AS_NODE="

echo.
echo   型チェックとビルドを実行し、インストーラを生成します。
echo   キャプチャーエンジンが未取得の場合は、先に約 180MB をダウンロードします。
echo.
call npm run build:win
if errorlevel 1 goto :error

echo.
echo   release フォルダにインストーラを生成しました。
echo   キャプチャーエンジンはインストーラへ同梱済みです。導入先の PC では
echo   ダウンロードなしで、初回起動時に自動で配置されます。
echo.
pause
exit /b 0

:error
echo.
echo   ビルドに失敗しました。上のメッセージをご確認ください。
echo.
pause
exit /b 1
