@echo off
title Servidor Comprobantes Web
cd /d "C:\TGPN\comprobantes_para_web"
echo ====================================================
echo  Iniciando Servidor de Comprobantes Web (Puerto 8085)
echo ====================================================
start "" http://localhost:8085/
node server.js
pause
