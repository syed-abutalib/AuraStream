$ErrorActionPreference = 'Stop'
Set-Location (Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend')
if (!(Test-Path 'node_modules')) { npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' } }
npm.cmd run dev
