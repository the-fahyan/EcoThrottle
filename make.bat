@echo off
setlocal
set TARGET=%1
if "%TARGET%"=="" set TARGET=check

if "%TARGET%"=="check" goto check
if "%TARGET%"=="backend-lint" goto backend_lint
if "%TARGET%"=="backend-test" goto backend_test
if "%TARGET%"=="frontend-lint" goto frontend_lint
if "%TARGET%"=="frontend-test" goto frontend_test
if "%TARGET%"=="frontend-build" goto frontend_build
if "%TARGET%"=="backend-dev" goto backend_dev
if "%TARGET%"=="frontend-dev" goto frontend_dev
if "%TARGET%"=="install" goto install

echo Unknown target: %TARGET%
exit /b 1

:install
cd backend && uv venv --python 3.12 .venv && uv pip install -e ".[dev]" && cd .. && cd frontend && npm install && cd ..
exit /b %ERRORLEVEL%

:backend_lint
cd backend && .venv\Scripts\ruff check . && .venv\Scripts\ruff format --check . && .venv\Scripts\mypy app && cd ..
exit /b %ERRORLEVEL%

:backend_test
cd backend && .venv\Scripts\pytest && cd ..
exit /b %ERRORLEVEL%

:frontend_lint
cd frontend && npm run lint && cd ..
exit /b %ERRORLEVEL%

:frontend_test
cd frontend && npm run test && cd ..
exit /b %ERRORLEVEL%

:frontend_build
cd frontend && npm run build && cd ..
exit /b %ERRORLEVEL%

:backend_dev
cd backend && .venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 && cd ..
exit /b %ERRORLEVEL%

:frontend_dev
cd frontend && npm run dev && cd ..
exit /b %ERRORLEVEL%

:check
call :backend_lint
if errorlevel 1 exit /b 1
call :backend_test
if errorlevel 1 exit /b 1
call :frontend_lint
if errorlevel 1 exit /b 1
call :frontend_test
if errorlevel 1 exit /b 1
call :frontend_build
if errorlevel 1 exit /b 1
echo === ALL CHECKS PASSED ===
exit /b 0
