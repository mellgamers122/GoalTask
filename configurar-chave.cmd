@echo off
setlocal
cd /d "%~dp0"
echo.
echo GoalTask - Configuracao da API-Football
echo A chave nao aparecera na tela enquanto voce cola.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s = Read-Host 'Cole o token da football-data.org' -AsSecureString; $k = [System.Net.NetworkCredential]::new('', $s).Password.Trim(); if ($k.Length -lt 20) { Write-Error 'O token parece curto demais. Nada foi salvo.'; exit 1 }; [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), ('FOOTBALL_DATA_TOKEN=' + $k + [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false)); Write-Host 'Token salvo com seguranca no arquivo .env.' -ForegroundColor Green"
if errorlevel 1 (
  echo.
  echo Nao foi possivel salvar. Tente novamente.
  exit /b 1
)
echo.
echo Agora feche e abra o GoalTask novamente.
endlocal
