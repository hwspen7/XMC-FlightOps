# X-Plane flight attitude + moderate fixed response patch

Baseline: after installing native observability, interruption recovery and session recovery patches.

## Changes

- Mobile round horizon now shows X-Plane aircraft phi/theta from the same telemetry snapshot as the desktop primary flight display.
- Both screens use the same sign convention: horizon rotates by minus actual roll, pitch shifts down for nose-up attitude.
- Phone tilt / yoke input remains separate below the horizon, and is never labeled aircraft attitude.
- Missing/stale telemetry shows NO FLIGHT DATA instead of an artificial zero/level horizon.
- Optional recommended fixed response: 60 degrees phone roll / 35 degrees phone pitch for full deflection, up from 45/25. This reduces sensitivity without adding filter latency. Roll and pitch polarity are preserved.

## Installation (PowerShell, Windows)

```powershell
cd E:\Personal_Project\xplane-motion-controller
Expand-Archive -LiteralPath 'E:\xplane-motion-controller-attitude-sensitivity-patch.zip' -DestinationPath (Get-Location).Path -Force
& .\scripts\apply-flight-response.ps1
pnpm --filter @xplane/web test
pnpm --filter @xplane/web build
```

Restart the existing NestJS server; refresh the phone page (re-enable Motion if Safari asks). No C++ rebuild is required.

## Ground checks

1. With the plane level and telemetry live, both mobile and desktop report 0 degrees and a level horizon, independent of phone orientation.
2. Use the X-Plane UI to place aircraft in an initial bank/pitch or carefully observe a turn on the ground/paused simulation; the mobile and desktop attitude must match actual X-Plane telemetry (not sensor tilt).
3. When X-Plane/WS disconnects, mobile displays NO FLIGHT DATA, not level flight.
4. The yoke command bars still follow the phone; no new orientation reversal. Test modest roll and pitch inputs on the ground first.
5. Verify pause-on-interruption and session recovery remain functional.

Note: Real aircraft roll/pitch is not yoke command deflection. X-Plane physics, aircraft type, trim, speed, autopilot and elapsed time affect response. Exact instantaneous frame equality with the game's instruments cannot be guaranteed across UDP/WebSocket sampling, but both app screens use the same X-Plane source.
