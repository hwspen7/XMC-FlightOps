# XPlane Motion Controller — Professional Operations Workbench

Development baseline: GitHub `main` at `200f2362c874752a7169ae9971f7c7cea97c1da7`.

This is a source-code feature upgrade for **X-Plane 12 flight simulation only**. Readouts, phase inference, envelope references and advisories are NOT certified instrumentation or aircraft-specific procedures.

## Three installable batches

1. **Batch 01**: `FlightAnalytics`, multi-track time chart, IAS reference envelope, engine symmetry crossplot, heading rose, source-grounded evidence, 15-minute bounded history.
2. **Batch 02**: `SystemTopology`, system indication diagrams, event swimlanes, debounced C++ flight phase, independent risk channels, native protocol validation and tests.
3. **Batch 03**: `OperationsSuite` tabs, explicit live recording, JSON and CSV export, import validation, replay, synthetic scenarios, Python multi-page PDF and standalone HTML flight debrief.

The single cumulative archive contains all three. **Do not install both the cumulative archive and individual batches.** Each ZIP has project-relative directories at its root; unpack directly into the repository as before. Existing monitoring and mobile flight controls are not removed. Files under existing paths include only deliberately modified C++ analysis, shared protocol, CMake and App integration.

## Windows direct install (cumulative)

Download the cumulative ZIP to `E:\xplane-motion-controller-operations-90plus.zip`. Close X-Plane 12, back up or commit local modifications, then:

```powershell
cd E:\Personal_Project\xplane-motion-controller

# Verify GitHub baseline (do not discard local changes to force this value)
git rev-parse --short HEAD
# Expected: 200f2362, or a descendant with manually reviewed conflicts

Expand-Archive `
  -LiteralPath "E:\xplane-motion-controller-operations-90plus.zip" `
  -DestinationPath (Get-Location).Path `
  -Force

git diff --check
git status -sb
```

## TypeScript test and build

Run in PowerShell. This presumes repository dependencies were already installed.

```powershell
$ErrorActionPreference = 'Stop'
$root = 'E:\Personal_Project\xplane-motion-controller'
function Confirm-Step($label) { if ($LASTEXITCODE -ne 0) { throw "$label FAILED" }; Write-Host "$label PASSED" -ForegroundColor Green }
Set-Location "$root\packages\shared"
.\node_modules\.bin\tsc.cmd -p tsconfig.json; Confirm-Step 'Shared TypeScript'
Set-Location "$root\apps\server"
.\node_modules\.bin\vitest.cmd run; Confirm-Step 'Backend Tests'
.\node_modules\.bin\nest.cmd build; Confirm-Step 'Backend Build'
Set-Location "$root\apps\web"
.\node_modules\.bin\vitest.cmd run; Confirm-Step 'Frontend Tests'
.\node_modules\.bin\tsc.cmd --noEmit; Confirm-Step 'Frontend TypeScript'
.\node_modules\.bin\vite.cmd build; Confirm-Step 'Frontend Production Build'
```

## Native C++ plugin — Developer PowerShell

```powershell
$root = 'E:\Personal_Project\xplane-motion-controller'
Set-Location $root
& 'E:\Application_Desktop\VisualStudio\Common7\Tools\Launch-VsDevShell.ps1' -Arch amd64 -HostArch amd64
$cmake = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Kitware.CMake_Microsoft.Winget.Source_8wekyb3d8bbwe\cmake-4.4.4-windows-x86_64\bin\cmake.exe"
$ctest = Join-Path (Split-Path $cmake) 'ctest.exe'
if (!(Test-Path $cmake) -or !(Test-Path $ctest)) { throw 'Missing CMake/CTest' }
if (!(Get-Command nmake -ErrorAction SilentlyContinue)) { throw 'Missing NMake' }
& $cmake -S native/xplane-plugin -B build/native-nmake -G 'NMake Makefiles' -DXPLANE_SDK_DIR='E:/Personal_Project/XPlaneSDK' -DBUILD_TESTING=ON
if ($LASTEXITCODE -ne 0) { throw 'Native configure failed' }
& $cmake --build build/native-nmake
if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
& $ctest --test-dir build/native-nmake --output-on-failure
if ($LASTEXITCODE -ne 0) { throw 'Native tests failed' }
```

## Plugin deployment (X-Plane must be closed)

```powershell
$root = 'E:\Personal_Project\xplane-motion-controller'
$source = "$root\build\native-nmake\win.xpl"
$target = 'G:\Steam\steamapps\common\X-Plane 12\Resources\plugins\XPlaneMotionController\64\win.xpl'
if (!(Test-Path $source)) { throw 'Compiled win.xpl not found' }
if (!(Test-Path (Split-Path $target))) { throw 'X-Plane plugin directory missing' }
if (Test-Path $target) { Copy-Item $target "$target.backup-$(Get-Date -Format yyyyMMdd-HHmmss)" -Force }
Copy-Item -LiteralPath $source -Destination $target -Force
if ((Get-FileHash $source -Algorithm SHA256).Hash -ne (Get-FileHash $target -Algorithm SHA256).Hash) { throw 'Deployment hash mismatch' }
Write-Host 'NATIVE PLUGIN DEPLOYED AND VERIFIED' -ForegroundColor Green
```

Start X-Plane and load an aircraft, then use two additional PowerShell windows:

```powershell
cd E:\Personal_Project\xplane-motion-controller
pnpm start:server
```

```powershell
cd E:\Personal_Project\xplane-motion-controller
pnpm start:web
```

## Recorder and offline report

Open Desktop Monitor -> `03 · RECORDER & DEBRIEF`, choose **START LIVE RECORDING**, then **STOP** before exporting `xplane-flight-record.json`.

```powershell
cd E:\Personal_Project\xplane-motion-controller
python -m pip install -r analysis/requirements.txt
python analysis/flight_report.py "E:\xplane-flight-record.json" --output "E:\flight-report.pdf" --html "E:\flight-report.html"
```

The recording is kept in the open browser tab until exported. It is *not automatically persisted* across page reloads. Import an exported file to scrub and inspect the recording later. The scenario library contains synthetic data, explicitly labeled DEMONSTRATION; it is not sensor-derived evidence.

## Validation and limitations

- C++ native analyzer and phase transitions have standalone tests. Native-vs-UDP telemetry depends on your runtime configuration; absent DataRefs remain unreported.
- New TypeScript components and protocol passed an isolated strict type check. A full Windows frontend/backend build and an actual X-Plane 12 simulator validation have not been performed in this environment.
- The HUD contains aircraft-agnostic advisory references rather than certified airworthiness envelopes. Displayed system diagrams are *monitoring associations*, not validated aircraft electrical/hydraulic wiring.
- Explicit instrument modes are reported as raw simulator mode codes where no aircraft-specific mode decoder is available. Do not treat a non-null mode number as a verified active mode.
- Downloads are browser-driven. Large or long flight sessions should be exported periodically. Python PDF and HTML reports require installing matplotlib.
- Target maturity is 90+ as a design objective; no measured 90/100 certification or complete-system claim is made before Windows integration and in-simulator regression tests.
