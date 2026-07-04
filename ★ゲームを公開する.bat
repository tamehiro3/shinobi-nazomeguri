@echo off
chcp 65001 >nul
title CryptoNinja 忍びの謎巡り - 公開ツール
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_to_github.ps1"
