@echo off
cd /d "%~dp0server"
echo Publicando a rota de noticias do GoalTask...
call npm.cmd run deploy
if errorlevel 1 (
  echo.
  echo Nao foi possivel publicar. Confira a conexao e tente novamente.
  pause
  exit /b 1
)
echo.
echo Noticias publicadas com sucesso.
pause
