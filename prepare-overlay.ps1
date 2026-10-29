#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$Overlay
)

$ErrorActionPreference = 'Stop'
$Repository = (Resolve-Path -LiteralPath $Repository).Path
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'operations.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Test-Path -LiteralPath (Join-Path $Repository '.git'))) {
    throw 'Target is not an existing Git working tree.'
}
$head = (& git -C $Repository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $manifest.baseline) {
    throw "Repository baseline mismatch. Expected $($manifest.baseline), found $head. Nothing was copied."
}
$dirty = @(& git -C $Repository status --porcelain --untracked-files=no)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) {
    throw 'Tracked working-tree changes detected. Commit or stash them before applying this patch.'
}

# Build complete changed source files in the temporary overlay directory.
# Preflight every replacement before writing any files.
$preexisting = @(Get-ChildItem -LiteralPath $Overlay -Recurse -File)
foreach ($newFile in $preexisting) {
    $relative = $newFile.FullName.Substring($Overlay.TrimEnd('\').Length).TrimStart('\', '/')
    if (Test-Path -LiteralPath (Join-Path $Repository $relative)) {
        throw "Patch would overwrite an existing new-file destination: $relative. Nothing was copied."
    }
}
$contents = @{}
$orderedPaths = [System.Collections.Generic.List[string]]::new()
foreach ($operation in $manifest.operations) {
    $relative = [string]$operation.path
    if ($relative.StartsWith('/') -or $relative.Contains('..') -or $relative.Contains('\')) {
        throw "Unsafe patch path: $relative"
    }
    if (-not $contents.ContainsKey($relative)) {
        $source = Join-Path $Repository ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not [IO.File]::Exists($source)) { throw "Missing source file: $relative" }
        $contents[$relative] = [IO.File]::ReadAllText($source, [Text.Encoding]::UTF8).Replace("`r`n", "`n")
        $orderedPaths.Add($relative)
    }
    $content = [string]$contents[$relative]
    if ($operation.type -eq 'replace') {
        $old = [string]$operation.old
        $replacement = [string]$operation.new
        $first = $content.IndexOf($old, [StringComparison]::Ordinal)
        if ($first -lt 0 -or $content.IndexOf($old, $first + $old.Length, [StringComparison]::Ordinal) -ge 0) {
            throw "Expected exactly one matching patch anchor in $relative. Nothing was copied."
        }
        $contents[$relative] = $content.Substring(0, $first) + $replacement + $content.Substring($first + $old.Length)
    } elseif ($operation.type -eq 'append') {
        $contents[$relative] = $content.TrimEnd() + "`n" + [string]$operation.ending
    } else {
        throw "Unknown patch operation: $($operation.type)"
    }
}
$utf8 = [System.Text.UTF8Encoding]::new($false)
foreach ($relative in $orderedPaths) {
    $destination = Join-Path $Overlay ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar))
    $parent = [IO.Path]::GetDirectoryName($destination)
    [IO.Directory]::CreateDirectory($parent) | Out-Null
    [IO.File]::WriteAllText($destination, [string]$contents[$relative], $utf8)
}
Write-Host "Overlay ready: $($orderedPaths.Count) existing files upgraded, plus the added C++ / web modules."
Write-Host "Source directory: $Overlay"
Write-Host 'No repository files have been changed. Now run robocopy as documented.'
