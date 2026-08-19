@echo off
rem Build the production bundle (one-time, or after pulling updated code).
cd /d %~dp0
node scripts\build-prod.cjs
pause
