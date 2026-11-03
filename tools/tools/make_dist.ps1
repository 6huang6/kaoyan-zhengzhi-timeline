# Build dist/ : publishable static site (runtime files only, no textbook corpus / screenshots)
# Usage:  powershell -ExecutionPolicy Bypass -File tools\make_dist.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$dist = Join-Path $root 'dist'
if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }
# 清空 dist，但保留 .git（发布仓库的提交历史）
Get-ChildItem $dist -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force

$dirs = @('css', 'js', 'data', 'vendor', 'docs', 'tools')
foreach ($d in $dirs) { Copy-Item -Recurse -Path (Join-Path $root $d) -Destination (Join-Path $dist $d) }
Copy-Item (Join-Path $root 'index.html') -Destination $dist
Copy-Item (Join-Path $root 'README.md') -Destination $dist

# one-off scripts not needed on the published site
$drop = @('extract_docx.py', 'geo.js', 'parse_outline.py', 'make_dist.ps1')
foreach ($f in $drop) {
  $p = Join-Path (Join-Path $dist 'tools') $f
  if (Test-Path $p) { Remove-Item -Force $p }
}
$p = Join-Path (Join-Path $dist 'docs') 'NODES.md'
if (Test-Path $p) { Remove-Item -Force $p }

# keep GitHub Pages from running Jekyll
New-Item -ItemType File -Path (Join-Path $dist '.nojekyll') | Out-Null

$stat = Get-ChildItem $dist -Recurse -File | Measure-Object -Property Length -Sum
Write-Host ("dist: {0} files, {1:N2} MB" -f $stat.Count, ($stat.Sum / 1MB))
Write-Host 'next: cd dist; git add -A; git commit -m update; git push'
