@echo off
chcp 65001 >nul
rem ═══ TermFleet 成员机一键启动 ═══
rem 前置：已装 dsh（dsh --version 可用）+ 本目录已 npm install
rem 用法：编辑下面三行后双击/运行本脚本
set TF_LEAD_URL=ws://192.168.1.17:3182/dsh-termfleet/bus
set TF_NAME=%COMPUTERNAME%
set TF_TOKEN=fleet-dev-2026

set TERMFLEET_ROLE=member
set TERMFLEET_NAME=%TF_NAME%
set TERMFLEET_LEAD_URL=%TF_LEAD_URL%
set TERMFLEET_TOKEN=%TF_TOKEN%

echo [TermFleet 成员机] 名字=%TF_NAME%  lead=%TF_LEAD_URL%
echo 启动中（Ctrl+C 退出）...
dsh --patch "%~dp0boot.patch.yml" --profile web --port 3181 --no-open
