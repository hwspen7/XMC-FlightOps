# Safe, idempotent sensitivity update; preserves the tested roll/pitch polarity.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$path = Join-Path $repo 'apps\web\src\controllers\yoke.ts'
if (-not (Test-Path -LiteralPath $path)) { throw 'Missing controllers/yoke.ts. Run inside the repository.' }
$content = [System.IO.File]::ReadAllText($path)

function Update-Travel([string]$name, [int]$oldValue, [int]$newValue) {
    $linePattern = '(?m)^(\s*' + [regex]::Escape($name) + ':\s*)(\d+)(\s*,\s*)$'
    $matches = [regex]::Matches($script:content, $linePattern)
    if ($matches.Count -ne 1) { throw "Expected exactly one $name field. No file was changed." }
    $currentValue = [int]$matches[0].Groups[2].Value
    if ($currentValue -ne $oldValue -and $currentValue -ne $newValue) {
        throw "Unexpected $name=$currentValue (expected $oldValue or $newValue). No file was changed."
    }
    $script:content = [regex]::Replace($script:content, $linePattern, {
        param($m)
        return $m.Groups[1].Value + $newValue + $m.Groups[3].Value
    })
}

Update-Travel 'rollTravelDegrees' 45 60
Update-Travel 'pitchTravelDegrees' 25 35
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Fixed yoke travel updated: 60 degrees roll / 35 degrees pitch.'
Write-Host 'No polarity, dead zone, smoothing, C++ or recovery logic changed.'
