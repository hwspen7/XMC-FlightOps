X-Plane Motion Controller - Desktop Operations Monitor Patch
===========================================================

This is a source-only incremental patch. Extract it over your existing repository.
It does NOT include node_modules, certificates, credentials, or a compiled X-Plane plugin.

WHAT CHANGED
------------
1. Consolidated desktop masthead, flight context, connection states and telemetry coverage into one operations header.
2. New aircraft-state interpretation panel with explicit data provenance and uncertainty.
3. Twelve additional read-only X-Plane dataref fields:
   normal load factor, outside air temperature, engine 1/2 N2, engine 1/2 EGT,
   engine 1/2 fuel flow, engine 1/2 oil pressure, total mass, fuel mass.
4. Expanded desktop trend history to 5 minutes / max 1,200 samples.
5. New interactive signal traces: 30s / 2m / 5m, series toggles, cursor readback,
   per-series latest/average/min/max, and gaps for missing values.
6. New instrument, aerodynamic, engine, fuel and configuration trends; no synthetic values.
7. Updated detailed parameter grid and dual engine readouts.

SAFETY & DATA SEMANTICS
-----------------------
This is an OBSERVER dashboard and does not change flight control commands.
Missing datarefs show ---; stale data does not become a fabricated reading.
Flap selection and surface deployment are separate. Landing gear deployment ratios
are not proof of mechanical downlock. Engine limits and flight warnings are not
assumed from aircraft-independent thresholds. Flight trend interpretations are
informational and are not certified alerts.

INSTALL (Windows PowerShell)
----------------------------
cd E:\Personal_Project\xplane-motion-controller
Expand-Archive -LiteralPath "E:\xplane-motion-controller-desktop-operations-patch.zip" -DestinationPath (Get-Location).Path -Force

BUILD SHARED TYPES
cd packages\shared
.\node_modules\.bin\tsc.cmd -p tsconfig.json
if ($LASTEXITCODE -ne 0) { throw 'Shared build failed' }

BUILD & TEST SERVER
cd ..\..\apps\server
.\node_modules\.bin\vitest.cmd run
if ($LASTEXITCODE -ne 0) { throw 'Server tests failed' }
.\node_modules\.bin\nest.cmd build
if ($LASTEXITCODE -ne 0) { throw 'Server build failed' }

BUILD & TEST WEB
cd ..\web
.\node_modules\.bin\vitest.cmd run
if ($LASTEXITCODE -ne 0) { throw 'Web tests failed' }
.\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Web typecheck failed' }
.\node_modules\.bin\vite.cmd build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }

REBUILD NATIVE PLUGIN
---------------------
Open the Visual Studio Developer PowerShell, stop X-Plane, then run:

cd E:\Personal_Project\xplane-motion-controller
$cmake = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Kitware.CMake_Microsoft.Winget.Source_8wekyb3d8bbwe\cmake-4.4.4-windows-x86_64\bin\cmake.exe"
& $cmake -S native/xplane-plugin -B build/native-nmake -G 'NMake Makefiles' -DXPLANE_SDK_DIR='E:/Personal_Project/XPlaneSDK' -DBUILD_TESTING=ON
if ($LASTEXITCODE -ne 0) { throw 'CMake configure failed' }
& $cmake --build build/native-nmake
if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
& (Join-Path (Split-Path $cmake) 'ctest.exe') --test-dir build/native-nmake --output-on-failure
if ($LASTEXITCODE -ne 0) { throw 'Native tests failed' }
Copy-Item 'build\native-nmake\win.xpl' 'G:\Steam\steamapps\common\X-Plane 12\Resources\plugins\XPlaneMotionController\64\win.xpl' -Force

Restart X-Plane and the NestJS server, then open:
https://192.168.1.68:8443/?view=desktop

LIMITATIONS
-----------
Aircraft vendor-specific custom datarefs (e.g., FMC routes, hydraulic circuit detail,
per-bus electrical load, ECAM/EICAS messages, autoland modes) are not yet supported.
The 5-minute history is browser-memory only. This patch does not claim full dispatch,
maintenance or certification-grade monitoring.

VERIFICATION PERFORMED HERE
---------------------------
- Native telemetry.cpp + stubs compiled using g++ with C++20, telemetry test passed.
- Changed TS/TSX syntax parsed successfully using TypeScript 5.9.
- Monitoring TSX graph and assessment modules passed an isolated strict check using
  compatibility shims. Full Windows web/server builds require your local environment.
