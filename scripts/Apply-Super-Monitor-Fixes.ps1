# PowerShell 5.1+; run from the repository root after extracting the ZIP.
# This operation patches files that are not distributed as stale full-file overlays.
# All text anchors are checked before writing; every changed file is backed up.
param([string]$Repository = "E:\Personal_Project\xplane-motion-controller")
$ErrorActionPreference = 'Stop'
$Repository = (Resolve-Path -LiteralPath $Repository).Path
if (-not (Test-Path -LiteralPath (Join-Path $Repository 'apps\web\src\components\mobile\B787PrimaryFlightDisplay.tsx'))) {
    throw 'Invalid repository root. Original mobile cockpit source not found.'
}
$staged = @{}
$originalEol = @{}
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Stage-Replace {
    param([string]$Path, [string]$Old, [string]$New)
    $full = Join-Path $Repository $Path
    if (-not $staged.ContainsKey($full)) {
        if (-not (Test-Path -LiteralPath $full)) { throw "Required file missing: $Path" }
        $raw = [System.IO.File]::ReadAllText($full)
        $originalEol[$full] = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
        $staged[$full] = $raw.Replace("`r`n", "`n")
    }
    $text = [string]$staged[$full]
    if ($text.Contains($New)) { return }
    $hits = [regex]::Matches($text, [regex]::Escape($Old)).Count
    if ($hits -ne 1) { throw "Source anchor mismatch ($hits): $Path. Source unchanged." }
    $staged[$full] = $text.Replace($Old, $New)
}
function Stage-Regex {
    param([string]$Path, [string]$Pattern, [string]$Replacement, [string]$DoneMarker)
    $full = Join-Path $Repository $Path
    if (-not $staged.ContainsKey($full)) {
        if (-not (Test-Path -LiteralPath $full)) { throw "Required file missing: $Path" }
        $raw = [System.IO.File]::ReadAllText($full)
        $originalEol[$full] = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
        $staged[$full] = $raw.Replace("`r`n", "`n")
    }
    $text = [string]$staged[$full]
    if ($text.Contains($DoneMarker)) { return }
    $rx = New-Object System.Text.RegularExpressions.Regex($Pattern,([System.Text.RegularExpressions.RegexOptions]::Singleline))
    if ($rx.Matches($text).Count -ne 1) { throw "Regex anchor mismatch: $Path. Source unchanged." }
    $staged[$full] = $rx.Replace($text, [System.Text.RegularExpressions.MatchEvaluator]{param($m) $Replacement})
}
$scaleImport = "import { PITCH_TICKS, pitchMark, radioAltitudeFeet } from '../../telemetry/instrumentScale';"
$attitudeImport = "import { horizonTransform, liveAircraftAttitude } from '../../telemetry/attitude';"
$sharedImport = "$attitudeImport`n$scaleImport"
$mobile = 'apps\web\src\components\mobile\B787PrimaryFlightDisplay.tsx'
Stage-Replace $mobile $attitudeImport $sharedImport
Stage-Replace $mobile 'const transform = attitude ? horizonTransform(attitude, 272, 176, 4.0) : '''';' 'const transform = attitude ? horizonTransform(attitude, 272, 176, 3.6) : '''';'
$mobileOld = @'
{[-40,-30,-20,-10,-5,-2.5,2.5,5,10,20,30,40].map(deg => {
            const major = Math.abs(deg) >= 10;
            const length = major ? 51 : Math.abs(deg) === 5 ? 31 : 18;
            return <g key={deg} transform={`translate(0 ${-deg * 4.0})`} stroke="#edf7ff" fill="#edf7ff" strokeWidth={major ? 1.9 : 1.3}>
              <path d={`M${-length} 0H-12 M12 0H${length}`}/>
              {major && <>
                <text stroke="none" fontSize="12" x="-67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
                <text stroke="none" fontSize="12" x="67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
              </>}
            </g>;
          })}
'@
$mobileOld = $mobileOld.Trim()
$mobileNew = @'
{PITCH_TICKS.filter(deg => Math.abs(deg) <= 40).map(deg => {
            const mark = pitchMark(deg);
            return <g key={deg} transform={`translate(0 ${-deg * 3.6})`} stroke="#edf7ff" fill="#edf7ff" strokeWidth={mark.strokeWidth}>
              <path d={`M${-mark.halfWidth} 0H-12 M12 0H${mark.halfWidth}`}/>
              {mark.label && <>
                <text stroke="none" fontSize="12" x="-67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
                <text stroke="none" fontSize="12" x="67" y="4" textAnchor="middle">{Math.abs(deg)}</text>
              </>}
            </g>;
          })}
'@
$mobileNew = $mobileNew.Trim()
Stage-Replace $mobile $mobileOld $mobileNew
Stage-Replace $mobile 'centerY: number, pxPerUnit: number)' 'centerY: number, pxPerUnit: number, minTick = Number.NEGATIVE_INFINITY)'
Stage-Replace $mobile 'Array.from({ length: 11 }, (_, i) => {' 'Array.from({ length: 27 }, (_, i) => {'
Stage-Replace $mobile 'base + (i - 5) * interval' 'base + (i - 13) * interval'
Stage-Replace $mobile 'item.y <= 309 && item.tick >= 0' 'item.y <= 309 && item.tick >= minTick'
Stage-Replace $mobile 'tapeMarks(ias, live, 20, 181, 2)' 'tapeMarks(ias, live, 10, 181, 2, 0)'
Stage-Replace $mobile 'tick%40===0?79:87' 'tick%20===0?79:87'
Stage-Replace $mobile 'tick%40===0 && <text' 'tick%20===0 && <text'
Stage-Replace $mobile 'tapeMarks(alt,live,200,181,.19)' 'tapeMarks(alt,live,100,181,.19)'
Stage-Replace $mobile 'tick%400===0?20:11' 'tick%200===0?20:11'
Stage-Replace $mobile 'tick%400===0 && <text' 'tick%200===0 && <text'
$radioMobile = @'
      {radioAltitudeFeet(telemetry.aglFeet,live) !== null && <g aria-label="Radar-height indication from X-Plane AGL">
        <rect x="347" y="286" width="90" height="27" rx="3" fill="#061a29" stroke="#78dff2" strokeWidth="1.2" />
        <text x="392" y="303" textAnchor="middle" fontSize="13" fontWeight="800" fill="#e7f9ff">RA {radioAltitudeFeet(telemetry.aglFeet,live)} FT</text>
      </g>}
'@
$radioMobile = $radioMobile.TrimEnd()
Stage-Replace $mobile '      <rect x="0" y="320" width="640" height="45" fill="#071723"/>' "$radioMobile`n      <rect x=`"0`" y=`"320`" width=`"640`" height=`"45`" fill=`"#071723`"/>"

$desktop='apps\web\src\components\monitor\FlightDisplay.tsx'
Stage-Replace $desktop $attitudeImport $sharedImport
Stage-Replace $desktop 'const PITCH_MARKS = [-60, -50, -40, -30, -20, -10, 10, 20, 30, 40, 50, 60];' 'const PITCH_MARKS = PITCH_TICKS.filter(deg => Math.abs(deg) <= 40);'
Stage-Replace $desktop 'const length = Math.abs(degree) % 20 === 0 ? 68 : 41;' 'const mark = pitchMark(degree); const length = mark.halfWidth;'
Stage-Replace $desktop '<path d={`M${-length} 0 H${-18} M18 0 H${length}`} strokeWidth="1.5" />' '<path d={`M${-length} 0 H${-18} M18 0 H${length}`} strokeWidth={mark.strokeWidth} />'
Stage-Replace $desktop '<text x={-length - 11} y="4" textAnchor="end" fontSize="12" stroke="none">{Math.abs(degree)}</text>' '{mark.label && <text x={-length - 11} y="4" textAnchor="end" fontSize="12" stroke="none">{Math.abs(degree)}</text>}'
Stage-Replace $desktop '<text x={length + 11} y="4" textAnchor="start" fontSize="12" stroke="none">{Math.abs(degree)}</text>' '{mark.label && <text x={length + 11} y="4" textAnchor="start" fontSize="12" stroke="none">{Math.abs(degree)}</text>}'
$radioDesktop = @'
          {radioAltitudeFeet(telemetry.aglFeet,live) !== null && <g aria-label="Radar-height indication from X-Plane AGL"><rect x="471" y="280" width="132" height="27" rx="3" fill="#061a29" stroke="#78dff2"/><text x="537" y="299" textAnchor="middle" fill="#e7f9ff" fontSize="15" fontWeight="800">RA {radioAltitudeFeet(telemetry.aglFeet,live)} FT</text></g>}
'@
$radioDesktop = $radioDesktop.TrimEnd()
Stage-Replace $desktop '          <rect x="24" y="48" width="116" height="265" fill="#283443"' "$radioDesktop`n          <rect x=`"24`" y=`"48`" width=`"116`" height=`"265`" fill=`"#283443`""

$motion='apps\web\src\components\mobile\MotionAttitude.tsx'
Stage-Replace $motion $attitudeImport $sharedImport
$motionOld = @'
{[-40,-30,-20,-10,10,20,30,40].map((degree) => <g key={degree} transform={`translate(0 ${-degree * 3.4})`} stroke="#f6f9fc" fill="#f6f9fc"><path d={`M${degree % 20 === 0 ? -50 : -28} 0 H-9 M9 0 H${degree % 20 === 0 ? 50 : 28}`} strokeWidth="1.7"/><text x="-64" y="4" fontSize="10" textAnchor="middle" stroke="none">{Math.abs(degree)}</text><text x="64" y="4" fontSize="10" textAnchor="middle" stroke="none">{Math.abs(degree)}</text></g>)}
'@
$motionOld = $motionOld.Trim()
$motionNew = @'
{PITCH_TICKS.filter(degree => Math.abs(degree) <= 40).map(degree => { const mark = pitchMark(degree); return <g key={degree} transform={`translate(0 ${-degree * 3.4})`} stroke="#f6f9fc" fill="#f6f9fc"><path d={`M${-mark.halfWidth} 0 H-9 M9 0 H${mark.halfWidth}`} strokeWidth={mark.strokeWidth}/>{mark.label && <><text x="-64" y="4" fontSize="10" textAnchor="middle" stroke="none">{Math.abs(degree)}</text><text x="64" y="4" fontSize="10" textAnchor="middle" stroke="none">{Math.abs(degree)}</text></>}</g>})}
'@
$motionNew = $motionNew.Trim()
Stage-Replace $motion $motionOld $motionNew
Stage-Replace $motion 'horizonTransform(attitude, 180, 172, 3.4)' 'horizonTransform(attitude, 180, 172, 3.6)'
Stage-Replace $motion '${-degree * 3.4}' '${-degree * 3.6}'
# Show radar altitude as an X-Plane readback only when within range.
$motionRA = @'
        {radioAltitudeFeet(telemetry.aglFeet,live) !== null && <g><rect x="216" y="274" width="105" height="27" rx="3" fill="#061824" stroke="#7ccfe7"/><text x="269" y="292" fill="#e0f8ff" textAnchor="middle" fontSize="12" fontWeight="750">RA {radioAltitudeFeet(telemetry.aglFeet,live)} FT</text></g>}
'@
$motionRA = $motionRA.TrimEnd()
Stage-Replace $motion '        <g transform="translate(180 10)">' "$motionRA`n        <g transform=`"translate(180 10)`">"

$controls='apps\web\src\components\mobile\CompactFlightControls.tsx'
Stage-Replace $controls "  active: boolean;`n  sendPedal:" "  active: boolean;`n  speedbrakeAuthorized?: boolean;`n  sendPedal:"
Stage-Replace $controls 'export function CompactFlightControls({ telemetry, live, active, sendPedal, sendAction }: Props) {' 'export function CompactFlightControls({ telemetry, live, active, speedbrakeAuthorized = false, sendPedal, sendAction }: Props) {'
Stage-Replace $controls 'className="fd-spoilers fd-speedbrake-button fd-tile" disabled={!active}' 'className="fd-spoilers fd-speedbrake-button fd-tile" disabled={!(active || (speedbrakeAuthorized && ground))} title="Manual ground toggle. Aircraft automatic touchdown deployment is configured separately in X-Plane."'
$mobileCockpit='apps\web\src\views\MobileCockpit.tsx'
Stage-Replace $mobileCockpit 'active={controlsAvailable} sendPedal={flight.sendPedal} sendAction={flight.sendAuxiliary}' 'active={controlsAvailable} speedbrakeAuthorized={armed && live && sim.outputEnabled} sendPedal={flight.sendPedal} sendAction={flight.sendAuxiliary}'

# Faster telemetry monitor only: no changes to flight-control apply, watchdog or ARM safety.
$plugin = 'native\xplane-plugin\src\plugin.cpp'
Stage-Replace $plugin 'if (now - last_telemetry >= std::chrono::milliseconds(100)) {' 'if (now - last_telemetry >= std::chrono::milliseconds(50)) {'
$gateway='apps\server\src\transport\control.gateway.ts'
Stage-Replace $gateway 'private readonly clock = setInterval(() => this.tick(), 100);' 'private readonly clock = setInterval(() => this.tick(), 50);'
Stage-Replace $gateway 'this.simulator.status().reachable ? 150 : 1000' 'this.simulator.status().reachable ? 80 : 1000'

$signal = 'apps\web\src\components\monitor\SignalPanel.tsx'
Stage-Replace $signal 'Native feedback RTT includes the 10 Hz telemetry interval.' 'Native feedback RTT includes the telemetry reporting interval; it is not pure control latency.'

# All checks pass before any write. Avoiding stale source overwrite is intentional.
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach($pair in $staged.GetEnumerator()) {
    $original = [System.IO.File]::ReadAllText($pair.Key)
    if ($original.Replace("`r`n", "`n") -ne $pair.Value) {
        [System.IO.File]::Copy($pair.Key, "$($pair.Key).before-instruments-$timestamp.bak", $false)
        $output = [string]$pair.Value
        if ($originalEol[$pair.Key] -eq "`r`n") { $output = $output.Replace("`n", "`r`n") }
        [System.IO.File]::WriteAllText($pair.Key, $output, $utf8)
        Write-Host "UPDATED: $($pair.Key.Substring($Repository.Length + 1))" -ForegroundColor Green
    }
}
Write-Host 'MOBILE + DESKTOP INSTRUMENTS, GROUND SPEEDBRAKE, AND TELEMETRY RATE PATCHED' -ForegroundColor Green
