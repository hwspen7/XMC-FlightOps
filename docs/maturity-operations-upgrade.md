# XPlane Motion Controller: Native Operations Upgrade

**Verified base:** GitHub `hwspen7/xplane-motion-controller` `main` at `808553d37244985030ddd9037f6f3566a2d3919d` (2026-10-29). This ZIP is an incremental source overlay, not a full repository. It contains no Python installer, preparation script, `.env`, certificates, Git metadata or compiled binaries. Its root contains `apps/`, `native/`, `packages/`, `docs/` directly.

## 1. Install the ZIP directly, using the established Windows method

Save `xplane-motion-controller-final-operations-patch.zip` directly in `E:\`.

```powershell
$ErrorActionPreference = 'Stop'
cd E:\Personal_Project\xplane-motion-controller
$expected = '808553d37244985030ddd9037f6f3566a2d3919d'
if ((git rev-parse HEAD).Trim() -ne $expected) {
    throw 'Git HEAD differs from the validated source baseline; stop before overwriting files.'
}
git status -sb

Expand-Archive `
  -LiteralPath 'E:\xplane-motion-controller-final-operations-patch.zip' `
  -DestinationPath (Get-Location).Path `
  -Force

git diff --check
git status -sb
```

**Important:** Back up or commit local uncommitted changes before extraction. The overlay replaces some existing source files and preserves untouched files from your repository. Do not run on a different Git baseline without a new merge review.

## 2. Build and test frontend and backend

This reuses the direct `.cmd` executables that already work in the target Windows environment.

```powershell
$root = 'E:\Personal_Project\xplane-motion-controller'
function Check-Build { param([string]$Name)
    if ($LASTEXITCODE -ne 0) { throw "$Name FAILED" }
    Write-Host "$Name PASSED" -ForegroundColor Green
}
Set-Location "$root\packages\shared"
.\node_modules\.bin\tsc.cmd -p tsconfig.json
Check-Build 'Shared TypeScript Build'
Set-Location "$root\apps\server"
.\node_modules\.bin\vitest.cmd run
Check-Build 'Backend Tests'
.\node_modules\.bin\nest.cmd build
Check-Build 'Backend Build'
Set-Location "$root\apps\web"
.\node_modules\.bin\vitest.cmd run
Check-Build 'Frontend Tests'
.\node_modules\.bin\tsc.cmd --noEmit
Check-Build 'Frontend TypeScript'
.\node_modules\.bin\vite.cmd build
Check-Build 'Frontend Production Build'
```

## 3. Build and test the C++ plugin

**Exit X-Plane 12 completely first.** Open Visual Studio Developer PowerShell or execute the following in PowerShell:

```powershell
cd E:\Personal_Project\xplane-motion-controller
& 'E:\Application_Desktop\VisualStudio\Common7\Tools\Launch-VsDevShell.ps1' -Arch amd64 -HostArch amd64
$cmake = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Kitware.CMake_Microsoft.Winget.Source_8wekyb3d8bbwe\cmake-4.4.4-windows-x86_64\bin\cmake.exe"
$ctest = Join-Path (Split-Path $cmake) 'ctest.exe'
if (!(Test-Path $cmake)) { throw 'CMake not found' }
if (!(Get-Command nmake -ErrorAction SilentlyContinue)) { throw 'NMake not found' }
& $cmake -S native/xplane-plugin -B build/native-nmake -G 'NMake Makefiles' -DXPLANE_SDK_DIR='E:/Personal_Project/XPlaneSDK' -DBUILD_TESTING=ON
if ($LASTEXITCODE -ne 0) { throw 'CMake configuration failed' }
& $cmake --build build/native-nmake
if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
& $ctest --test-dir build/native-nmake --output-on-failure
if ($LASTEXITCODE -ne 0) { throw 'Native tests failed' }
Write-Host 'NATIVE PLUGIN BUILD AND TESTS PASSED' -ForegroundColor Green
```

## 4. Back up and deploy win.xpl

```powershell
cd E:\Personal_Project\xplane-motion-controller
$source = 'build\native-nmake\win.xpl'
$target = 'G:\Steam\steamapps\common\X-Plane 12\Resources\plugins\XPlaneMotionController\64\win.xpl'
if (!(Test-Path $source)) { throw 'Compiled win.xpl not found' }
if (!(Test-Path (Split-Path $target))) { throw 'X-Plane plugin directory not found' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (Test-Path $target) {
    Copy-Item -LiteralPath $target -Destination "$target.backup-$stamp" -Force
}
Copy-Item -LiteralPath $source -Destination $target -Force
Get-Item $target | Select-Object Name,Length,LastWriteTime
Write-Host 'X-PLANE PLUGIN UPDATED' -ForegroundColor Green
```

## 5. Run

Start X-Plane 12, load an aircraft, then in another PowerShell window:

```powershell
cd E:\Personal_Project\xplane-motion-controller
pnpm start:server
```

## What changed and what did not

The current main branch's 67 native DataRefs remain intact. The overlay adds 24 **read-only** DataRefs and 7 computed analyzer fields. It retains the established property names (`normalLoadG`, `egtLeftC`, `fuelFlowLeftKgS`, `fuelWeightKg`) rather than renaming them. These cover basic flight director/autopilot state, navigation deviation, engine running feedback, electrical generation, hydraulic readbacks, cabin pressurization and anti-ice. Unknown DataRefs are reported as null, never invented.

The original `DesktopMonitor.tsx`, `HistoryChart.tsx`, `useTelemetryHistory.ts`, mobile flight controls, navigation, connection handling, and control authority modules are **not overwritten**. The original 30-second / 2-minute / 5-minute interactive plots, FlightAssessment and engine panels remain. The extra SystemsHealth read-only section adds event tracking, CSV export and four additional decimated 1/5/15-minute trend charts.

The C++ flight-loop analysis adds 11 advisory classes with bounded memory, sustained-state checks and risk indices. These are **heuristics**, not certified aircraft-specific warnings, and their absence does not guarantee system safety. Hydraulic pressure DataRefs use **aircraft-defined units**, so the new interface labels them as raw pressure rather than imposing PSI; the hydraulic alert uses available fluid ratio instead. The analysis never writes simulator DataRefs or changes remote control behavior.

## Verification

Independently tested in the construction environment: C++ flight analysis and native telemetry executables passed with GCC and strict warnings. TypeScript strict static checking passed for the shared types, native wire parser, legacy telemetry mapping and SystemsHealth component. Native packet acceptance/rejection runtime tests passed, as did the unique-index and 91-field C++/TypeScript contract audit. Archive integrity and root-directory layout were verified. **A full Windows NMake build, full original repository test suite and a live X-Plane 12 test have not been run in this environment**, and must be performed before production use. This release makes no unsupported 100/100 engineering maturity claim.
