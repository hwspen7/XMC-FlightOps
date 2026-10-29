# XPlane Motion Controller — Professional Operations Dashboard

## Scope and source baseline

- Patch type: direct-extraction overlay at the repository root.
- Baseline: GitHub `main` commit `200f2362c874752a7169ae9971f7c7cea97c1da7`, with the previously installed 90-plus operations package.
- Does not modify native plugin, server protocol, mobile controls, recording engine, or flight analytics logic.
- Replaces `apps/web/src/App.tsx` with a three-workspace desktop shell. Adds a separate, responsive high-density overview component and stylesheet. Retains the prior responsive reflow stylesheet for the original full-telemetry workspace. The existing advanced systems/analytics/recorder workspace remains available. The existing original desktop monitor is available on demand.
- All sensor readbacks and chart history are sourced from current `ServerStatus` and `useTelemetryHistory`. Missing or stale values are displayed as unavailable, not synthesized.
- Flight phase and advisory interpretation comes from the already installed `flightAnalytics.picture()` helper and must not be treated as certified flight warnings.

## Install (Windows PowerShell)

Download `xplane-motion-controller-professional-dashboard-patch.zip` to `E:\`.

```powershell
cd E:\Personal_Project\xplane-motion-controller

git status -sb

Expand-Archive `
  -LiteralPath "E:\xplane-motion-controller-professional-dashboard-patch.zip" `
  -DestinationPath (Get-Location).Path `
  -Force

git diff --check

cd apps\web
.\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw "Frontend TypeScript FAILED" }

.\node_modules\.bin\vitest.cmd run
if ($LASTEXITCODE -ne 0) { throw "Frontend Tests FAILED" }

.\node_modules\.bin\vite.cmd build
if ($LASTEXITCODE -ne 0) { throw "Frontend Build FAILED" }
```

Refresh the desktop browser page after build or restart the web development server as required by the local setup. No native `win.xpl` rebuild or redeploy is required for this front-end-only overlay.

## Design and behavior

- **Live Overview (default)**: compact simulator-status strip; PFD-style attitude visualization; relative ground-track plot; dual-engine readouts; fuel and mobile controller status; six subsystem summaries; eight compact cursor-linked charts; event timeline, current advisories, N1 symmetry scatter, and independent C++ risk components.
- **Systems / Analytics / Replay**: existing three-tab operations suite for topology, advanced flight analysis and flight recording/debrief.
- **All Telemetry**: existing detailed desktop monitor, mounted only when opened for lower default rendering overhead.
- Chart views: 2-minute and 5-minute windows, controlled globally on the overview. The original history hook retains up to 5 minutes; longer archival review is available through the recorder and specialist workspace.
- Airspeed envelope uses available aircraft-specific Vso/Vs/Vfe/Vne readbacks and does **not** invent numerical reference speeds.
- Relative track uses measured latitude/longitude and is explicitly not a navigational basemap.
- Other system diagrams are readback indicators rather than reconstructed wiring, hydraulic topology, or cockpit-certified annunciations.
- Mobile ARM and control-phase status alone do not mean the X-Plane control override is confirmed. Native override status is displayed separately.

## Validation

Source-level strict TypeScript check of the new dashboard, workspace shell, shared types and operational-picture logic passed in an isolated fixture. Full repository browser build and real X-Plane testing must be executed on the target Windows machine before operational sign-off.
