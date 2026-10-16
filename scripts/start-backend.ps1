param([switch]$Build, [string]$InitAdmin = '')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($Build) {
    if (!(Test-Path '.tools/vcpkg/vcpkg.exe')) { throw 'Run scripts/setup.ps1 first.' }
    cmake -S . -B build -A x64 "-DCMAKE_TOOLCHAIN_FILE=$((Get-Location).Path)/.tools/vcpkg/scripts/buildsystems/vcpkg.cmake" "-DVCPKG_INSTALLED_DIR=$((Get-Location).Path)/vcpkg_installed"
    if ($LASTEXITCODE -ne 0) { throw 'CMake configuration failed' }
    cmake --build build --config Release --parallel 4
    if ($LASTEXITCODE -ne 0) { throw 'C++ build failed' }
}
if (!(Test-Path 'build/backend/Release/aurastream.exe')) { throw 'Backend is not built. Run scripts/setup.ps1.' }
if ($InitAdmin) { & './build/backend/Release/aurastream.exe' --init-admin $InitAdmin }
else { & './build/backend/Release/aurastream.exe' }
if ($LASTEXITCODE -ne 0) { throw 'AuraStream exited with an error. Check XAMPP MySQL and backend/.env.' }
