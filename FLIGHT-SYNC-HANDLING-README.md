# Flight Control Synchronization and Handling Patch

Incremental source patch for feature/native-flight-observability, installed **after** the native-observability, interruption-recovery, session-recovery, attitude-sensitivity and dynamic-yoke-test patches. This ZIP is not the full repository.

This patch does not alter X-Plane override ownership, the 350 ms native watchdog, session recovery, resume behavior, throttle mapping, or the empirically validated roll/pitch signs.

## Features

- Native X-Plane plugin samples eight additional DataRefs: joystick roll/pitch, cockpit pilot roll/pitch, total/merged roll/pitch, and roll/pitch override flags.
- Native plugin tags the last successfully **applied** control command in the same 10 Hz telemetry snapshot. Missing DataRefs stay absent; server reports null, not zero.
- NestJS parses these additions; it also registers the DataRefs in the optional legacy-UDP telemetry definitions. Both old and new modes can be read without false values.
- Mobile shows phone command separately from simulator pilot input and linked/total controls. Desktop monitoring shows command, joystick readback, pilot controls, merged controls and input deltas.
- The readback diagnostic compares native-applied command with joystick DataRef in a synchronized native telemetry sample. A tolerance of 0.06 (6 percentage points of full-scale travel) defines readback deviation. This is a **diagnostic only**; it does not disarm on transient variation.
- Soft-center static response: `rollTravelDegrees=60`, `pitchTravelDegrees=35`, `deadZone=0.015`, `centerGain=0.85`. Immediate (no smoothing timer), symmetric and monotonic. Full travel still maps to ±1. Existing signs stay unchanged.

## Aircraft compatibility

X-Plane publishes three different concepts, which must NOT be conflated:

1. `sim/joystick/yoke_*_ratio`: input overridden by this native plugin. Used for readback comparison.
2. `sim/cockpit2/controls/yoke_*_ratio`: pilot-side input. Appropriate for independent stick visualization; not necessarily the final cockpit animation on mechanically linked airplanes.
3. `sim/cockpit2/controls/total_*_ratio`: final combined input, including linkage, artificial stability and autopilot effects. Used by linked Boeing-style flight-control animations.

Source: https://developer.x-plane.com/article/pilot-and-copilot-flight-control-inputs/

No generic DataRef can guarantee visually identical cockpit control animations across arbitrary custom aircraft; plugins may implement custom flight-control models. We do not hardcode a 737-800 or claim these three measures must equal each other.

## Installation and tests (PowerShell)

```powershell
cd E:\Personal_Project\xplane-motion-controller
git branch --show-current  # expected: feature/native-flight-observability
$zip = "E:\xplane-motion-controller-flight-sync-handling-patch.zip"
if (-not (Test-Path -LiteralPath $zip)) { throw "Patch ZIP not found" }
Expand-Archive -LiteralPath $zip -DestinationPath (Get-Location).Path -Force

pnpm --filter @xplane/shared build
pnpm --filter @xplane/server test
pnpm --filter @xplane/web test
pnpm --filter @xplane/server build
pnpm --filter @xplane/web build
```

In **Visual Studio Developer PowerShell**, configure and build the existing Windows native build folder:

```powershell
$cmake = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Kitware.CMake_Microsoft.Winget.Source_8wekyb3d8bbwe\cmake-4.4.4-windows-x86_64\bin\cmake.exe"
& $cmake -S native/xplane-plugin -B build/native-nmake -G "NMake Makefiles" -DXPLANE_SDK_DIR="E:/Personal_Project/XPlaneSDK" -DBUILD_TESTING=ON
& $cmake --build build/native-nmake
$ctest = Join-Path (Split-Path $cmake) "ctest.exe"
& $ctest --test-dir build/native-nmake --output-on-failure
```

Expected C++ test names: `protocol`, `control`, `native_metrics`, `latest_control`, `telemetry`, `pause_guard` (6 tests).

**Only after all tests/builds pass**, completely close X-Plane and install the new plugin:

```powershell
$src="E:\Personal_Project\xplane-motion-controller\build\native-nmake\win.xpl"
$dst="G:\Steam\steamapps\common\X-Plane 12\Resources\plugins\XPlaneMotionController\64\win.xpl"
if (Get-Process -Name "X-Plane" -ErrorAction SilentlyContinue) { throw "Close X-Plane first" }
Copy-Item $src $dst -Force
Get-FileHash $src -Algorithm SHA256
Get-FileHash $dst -Algorithm SHA256
```

Restart X-Plane and `pnpm start:server` (only one server instance). Refresh the desktop monitor and mobile Safari page. First verify data and controls in a parked aircraft, then manually test disarm, background/suspend, recovery and resume. Only commit after these checks.

## Validation performed while authoring

- Native CMake tests: 6/6 pass under GCC 14, including new DataRef-readback test.
- Native plugin syntax check against included SDK test stubs: pass.
- TypeScript/TSX syntax translation: 54 files, no syntax errors.
- Node smoke checks: both phone landscape orientations preserve correct roll sign, response symmetry, native wire format parsing and input delta detection pass.
- Full pnpm test and Windows X-Plane 12 in-simulator verification **not run** in the authoring environment; they must be run locally.

## Rollback

Do not delete the prior `win.xpl` until the parked-aircraft validation passes. Back up local uncommitted changes before extraction. The patch contains only changed/new source files and this document; no secrets, certificates, DLLs or compiled binaries.
