# XPlane Motion Controller — Integrated Aeronautical Monitoring Upgrade

## Target and contents

Integration baseline: GitHub `hwspen7/xplane-motion-controller` `main` at `200f2362` (October 29, 2026). Preserve any newer local changes separately before overlaying the ZIP.

This is a source-overlay release, not a complete repository. It includes the previous operations, flight analysis, recorder, and professional dashboard code with cumulative TypeScript fixes. New features include:

- **Genuine FAA chart tile services:** VFR Sectional, IFR Area/Low and IFR High for supported US regions, plus OpenStreetMap street map. These are real chart layers, not hand-drawn imitation VFR or IFR graphics.
- **Position:** live Web Mercator map, georeferenced five-minute track overlay, heading-oriented airplane marker, follow/recenter, zoom, drag pan, coordinate/observed ground-track bearing and separate flight-path-angle readouts, visible source attribution and missing-coverage warnings.
- **Spatial monitoring:** three-dimensional orthographic aircraft model with actual roll, pitch, heading; relative three-dimensional ENU history path with MSL altitude; pilot control-vector and actual X-Plane body-axis angular rates. No synthetic flight samples or real terrain is claimed.
- **Time series:** 12 compact plots, including aerodynamic angles, P/Q/R rates, flap/actuator tracking and pitch input/response, plus 30-second / 2-minute / 5-minute synchronized cursors. Traces break across missing samples or observation gaps.
- **Events:** active advisory lane derives the latest `raised`/`cleared` state per flag, rather than repeating every raised event.

### Sources and geographic limits

FAA chart tile services (U.S. regions only):

- VFR: `https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer`
- IFR Low: `https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_AreaLow/MapServer`
- IFR High: `https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_High/MapServer`
- Street: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`

FAA chart caches have fixed supported zooms, generally 7–12 or 8–12. The viewport limits chart zoom accordingly and requests only currently visible tiles. Availability, chart currency and geographic coverage are subject to the FAA/ArcGIS service. OpenStreetMap attribution is permanently displayed when its street layer is selected. No tile prefetch, offline downloading, account or API-key bypass is implemented.

These charts are for flight simulation monitoring only. **Not for real-world navigation or use as certified flight instrumentation.** The 3D ground grid is a schematic, not physical terrain. The 3D flight track uses a local short-range coordinate approximation with visually exaggerated elevation ×2, explicitly labelled.

### Windows install

1. Stop any build/production preview that may lock files. Back up uncommitted changes.
2. Put the downloaded ZIP at `E:\xplane-motion-controller-super-monitor-patch.zip`.
3. Run:

```powershell
cd E:\Personal_Project\xplane-motion-controller
Expand-Archive `
  -LiteralPath "E:\xplane-motion-controller-super-monitor-patch.zip" `
  -DestinationPath (Get-Location).Path `
  -Force

git diff --check
```

### Frontend verification

```powershell
$ErrorActionPreference = "Stop"
$root = "E:\Personal_Project\xplane-motion-controller"
Set-Location "$root\packages\shared"
.\node_modules\.bin\tsc.cmd -p tsconfig.json
if ($LASTEXITCODE -ne 0) { throw "Shared TypeScript FAILED" }
Set-Location "$root\apps\server"
.\node_modules\.bin\vitest.cmd run
if ($LASTEXITCODE -ne 0) { throw "Backend Tests FAILED" }
.\node_modules\.bin\nest.cmd build
if ($LASTEXITCODE -ne 0) { throw "Backend Build FAILED" }
Set-Location "$root\apps\web"
.\node_modules\.bin\vitest.cmd run
if ($LASTEXITCODE -ne 0) { throw "Frontend Tests FAILED" }
.\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw "Frontend TypeScript FAILED" }
.\node_modules\.bin\vite.cmd build
if ($LASTEXITCODE -ne 0) { throw "Frontend Production Build FAILED" }
Write-Host "WEB AND SERVER PASSED" -ForegroundColor Green
```

### C++ deployment

Because this cumulative package includes changes to the native plugin, rebuild and test `win.xpl` **only after the frontend and backend succeed**, then deploy. The previous documented Visual Studio Developer PowerShell / CMake / NMake build and backup process is in `docs/operations-90plus.md`.

### Live acceptance checks

- With the simulator unavailable, do not invent position, flight angles or active warnings. The map should not load unseen tiles without valid coordinates.
- Load a US flight in X-Plane. Verify VFR, IFR LOW, IFR HIGH and STREET visibly change the underlying map layer. Outside chart coverage, switch to STREET.
- Pan/zoom with the mouse, then use the follow button to recenter. Heading and track must not be substituted for each other.
- Bank right and pitch up to compare 3D model orientation to X-Plane and the existing primary flight display.
- For 3D track history, verify vertical variation uses MSL altitude samples and the indicated ×2 display exaggeration.
- Verify stale or missing phone controls and sensor data show unavailable readings.
- Verify advanced charts separate missing samples, use correct time axes, and advisory state clears after the actual cleared event.

### Testing status

Isolated strict TypeScript checking and math smoke tests were performed on the new/modified modules. The full Windows pnpm build, native Windows plugin build, and actual X-Plane flight session **must be validated locally**; no 90+/100 score is claimed without those checks.
