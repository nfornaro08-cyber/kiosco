@echo off
setlocal

rem Kiosco del Recreo - lanzador para Windows
rem Busca Bun en el PATH y, si no esta, usa el runtime portable incluido en el perfil.

where bun >nul 2>nul
if %errorlevel%==0 (
  bun run src/server.js
  goto :end
)

rem Bun instalado con el instalador oficial (https://bun.sh)
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
  "%USERPROFILE%\.bun\bin\bun.exe" run src/server.js
  goto :end
)

rem Runtime portable (otras maquinas)
set "BUN=%USERPROFILE%\bun-runtime\bun-windows-x64\bun.exe"
if exist "%BUN%" (
  "%BUN%" run src/server.js
  goto :end
)

echo.
echo   No se encontro Bun.
echo   Instalalo desde https://bun.sh o descarga el runtime portable en:
echo   %USERPROFILE%\bun-runtime\bun-windows-x64\bun.exe
echo.
pause

:end
endlocal
