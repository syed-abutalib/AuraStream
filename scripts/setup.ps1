$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
foreach ($tool in @('git', 'cmake', 'node', 'npm.cmd')) { if (!(Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Install $tool before continuing. See README.md." } }
if (!(Test-Path '.tools/vcpkg')) {
    git clone https://github.com/microsoft/vcpkg.git .tools/vcpkg
    if ($LASTEXITCODE -ne 0) { throw 'vcpkg download failed' }
    git -C .tools/vcpkg checkout 0699a19d0c6386247ce50d4dedbb8217d484d536
    if ($LASTEXITCODE -ne 0) { throw 'vcpkg baseline checkout failed' }
}
& '.tools/vcpkg/bootstrap-vcpkg.bat' -disableMetrics
if ($LASTEXITCODE -ne 0) { throw 'vcpkg bootstrap failed' }
cmake -S . -B build -A x64 "-DCMAKE_TOOLCHAIN_FILE=$((Get-Location).Path)/.tools/vcpkg/scripts/buildsystems/vcpkg.cmake" "-DVCPKG_INSTALLED_DIR=$((Get-Location).Path)/vcpkg_installed"
if ($LASTEXITCODE -ne 0) { throw 'CMake configuration failed' }
cmake --build build --config Release --parallel 4
if ($LASTEXITCODE -ne 0) { throw 'C++ compilation failed' }
ctest --test-dir build -C Release --output-on-failure
if ($LASTEXITCODE -ne 0) { throw 'C++ tests failed' }
Push-Location frontend
try { npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm installation failed' }; npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' } } finally { Pop-Location }
Write-Host 'Setup complete. Start XAMPP MySQL, then use start-backend.ps1 and start-frontend.ps1 in separate terminals.'
