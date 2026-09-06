@echo off
chcp 932 > nul
cd /d "%~dp0"
title Capture - GitHub プッシュ
setlocal

set "REPO_URL=https://github.com/KisaragiIchigo/Capture.git"
set "REPO_URL_ALT=https://github.com/KisaragiIchigo/Capture"
set "BRANCH=main"
set "ORIGIN_FILE=%TEMP%\capture_git_origin.txt"
set "STATUS_FILE=%TEMP%\capture_git_status.txt"
set "BRANCH_FILE=%TEMP%\capture_git_branch.txt"
set "MSG_FILE=%TEMP%\capture_git_message.txt"

git --version > nul 2>&1
if errorlevel 1 goto :no_git

echo.
echo   プッシュ先 : %REPO_URL%
echo.

if exist ".git\" goto :check_remote

echo   このフォルダはまだ Git リポジトリではありません。初期化します。
echo.
git init -b %BRANCH%
if errorlevel 1 (
  git init
  if errorlevel 1 goto :error
  git symbolic-ref HEAD refs/heads/%BRANCH%
)
git remote add origin "%REPO_URL%"
if errorlevel 1 goto :error
goto :stage

:check_remote
git remote get-url origin > "%ORIGIN_FILE%" 2>nul
if errorlevel 1 goto :add_remote
set /p CURRENT_URL=<"%ORIGIN_FILE%"
del "%ORIGIN_FILE%" > nul 2>&1
if /i "%CURRENT_URL%"=="%REPO_URL%" goto :stage
if /i "%CURRENT_URL%"=="%REPO_URL_ALT%" goto :stage
echo   origin が想定と別の場所を指しているため、中断しました。
echo.
echo     現在 : %CURRENT_URL%
echo     想定 : %REPO_URL%
echo.
echo   意図した切り替えであれば、次のコマンドを実行してから開き直してください。
echo.
echo     git remote set-url origin %REPO_URL%
echo.
pause
exit /b 1

:add_remote
del "%ORIGIN_FILE%" > nul 2>&1
git remote add origin "%REPO_URL%"
if errorlevel 1 goto :error

:stage
echo   変更をステージします。.gitignore で除外したものは含みません。
git add -A
if errorlevel 1 goto :error

git status --porcelain > "%STATUS_FILE%" 2>nul
if errorlevel 1 goto :error
for %%A in ("%STATUS_FILE%") do if %%~zA equ 0 goto :no_change
del "%STATUS_FILE%" > nul 2>&1

echo.
echo   ---- コミットする内容 ----
git status --short
echo   --------------------------
echo.
echo   コミットメッセージを入力してください。
echo   空欄のまま Enter を押すと、日時を使った既定のメッセージになります。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$m = Read-Host '  メッセージ'; if ([string]::IsNullOrWhiteSpace($m)) { $m = '更新 ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }; [System.IO.File]::WriteAllBytes($env:MSG_FILE, [System.Text.Encoding]::UTF8.GetBytes($m))"
if not exist "%MSG_FILE%" goto :cancelled

git commit -F "%MSG_FILE%"
set "COMMIT_RESULT=%errorlevel%"
del "%MSG_FILE%" > nul 2>&1
if not "%COMMIT_RESULT%"=="0" goto :error
goto :resolve_branch

:no_change
del "%STATUS_FILE%" > nul 2>&1
echo.
echo   コミットする変更はありません。まだ送っていないコミットだけをプッシュします。

:resolve_branch
git rev-parse --abbrev-ref HEAD > "%BRANCH_FILE%" 2>nul
if errorlevel 1 goto :confirm
set /p CURRENT_BRANCH=<"%BRANCH_FILE%"
del "%BRANCH_FILE%" > nul 2>&1
if not "%CURRENT_BRANCH%"=="" set "BRANCH=%CURRENT_BRANCH%"

:confirm
echo.
echo   プッシュ先 : %REPO_URL%
echo   ブランチ   : %BRANCH%
echo.
set "ANSWER="
set /p "ANSWER=  プッシュしますか？ (Y/N) : "
if /i not "%ANSWER%"=="Y" goto :cancelled

echo.
git push -u origin %BRANCH%
if errorlevel 1 goto :push_error

echo.
echo   プッシュが完了しました。
echo   https://github.com/KisaragiIchigo/Capture
echo.
pause
exit /b 0

:push_error
echo.
echo   プッシュに失敗しました。よくある原因は次の 2 つです。
echo.
echo   1. リモートに、手元へ取り込んでいない履歴がある
echo      次のコマンドで取り込んでから、もう一度実行してください。
echo.
echo        git pull --rebase origin %BRANCH%
echo.
echo   2. GitHub の認証が通っていない
echo      表示された画面またはブラウザで、GitHub にサインインし直してください。
echo.
pause
exit /b 1

:cancelled
del "%MSG_FILE%" > nul 2>&1
echo.
echo   プッシュを中止しました。コミット済みの内容はそのまま残っています。
echo.
pause
exit /b 0

:no_git
echo.
echo   Git が見つかりません。https://git-scm.com/ からインストールし、
echo   コマンドプロンプトを開き直してから実行してください。
echo.
pause
exit /b 1

:error
echo.
echo   Git の操作に失敗しました。上のメッセージをご確認ください。
echo.
pause
exit /b 1
