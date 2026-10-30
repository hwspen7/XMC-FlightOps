<div align="center">

# XMC FlightOps

### Integrated Flight Control & Operations Monitoring for X-Plane

**A full-stack flight-simulation platform connecting motion-based mobile flight control, a live desktop operations console, and a native C++ integration layer.**

Real-time flight instrumentation · Aircraft systems diagnostics · Telemetry analytics · Flight recording and replay · Offline debrief

<p>
  <a href="https://github.com/hwspen7/xplane-motion-controller/actions/workflows/checks.yml"><img alt="CI — GitHub Actions" src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white"></a>
  <a href="LICENSE"><img alt="License — PolyForm Noncommercial 1.0.0" src="https://img.shields.io/badge/License-PolyForm%20Noncommercial-8250DF?style=flat-square"></a>
  <img alt="Purpose — Flight Simulation" src="https://img.shields.io/badge/Purpose-Flight%20Simulation-1E607B?style=flat-square">
</p>

<br>

<sub><strong>FLIGHT SIMULATION & NATIVE SYSTEMS</strong></sub>
<p>
  <img alt="X-Plane 12" src="https://img.shields.io/badge/X--Plane-12-175379?style=flat-square">
  <img alt="C++20" src="https://img.shields.io/badge/C%2B%2B-20-00599C?style=flat-square&logo=cplusplus&logoColor=white">
  <img alt="X-Plane SDK" src="https://img.shields.io/badge/X--Plane-SDK-24506A?style=flat-square">
  <img alt="CMake" src="https://img.shields.io/badge/CMake-Build-064F8C?style=flat-square&logo=cmake&logoColor=white">
  <img alt="UDP" src="https://img.shields.io/badge/Transport-UDP-405B76?style=flat-square">
</p>

<sub><strong>DESKTOP, MOBILE & TELEMETRY</strong></sub>
<p>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Vite 7" src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white">
  <img alt="WebSocket" src="https://img.shields.io/badge/Realtime-WebSocket-1D7690?style=flat-square">
  <img alt="Device Motion" src="https://img.shields.io/badge/Mobile-Device%20Motion-7358BA?style=flat-square">
</p>

<sub><strong>BACKEND, ANALYTICS & ENGINEERING</strong></sub>
<p>
  <img alt="NestJS 11" src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white">
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-Reports-3776AB?style=flat-square&logo=python&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-Workspace-F69220?style=flat-square&logo=pnpm&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-Testing-6E9F18?style=flat-square&logo=vitest&logoColor=white">
  <img alt="HTTPS" src="https://img.shields.io/badge/Mobile-HTTPS-13856E?style=flat-square">
</p>

</div>
## Flight operations, in one view

![Live Flight Operations Overview](.github/assets/flight-operations-overview.webp)

*Live flight overview — primary flight instrument, aeronautical position, propulsion and fuel readouts, and mobile-controller health.*

![Spatial Flight Monitoring](.github/assets/spatial-flight-monitor.webp)

*Spatial monitoring — aircraft attitude, flight path, control vectors, electrical and hydraulic indications, and aircraft systems.*

## Capabilities

| Flight control | Flight observability |
| :--- | :--- |
| **Motion-aware mobile cockpit** with attitude-based input, throttle, flap, gear, and control-state feedback. | **Live desktop overview** with flight instruments, position, engines, fuel, aircraft configuration, and subsystem indicators. |
| **Native C++ control bridge** with authenticated commands, control ownership, input freshness checks, and interruption handling. | **Operations workspace** with subsystem monitoring, flight analytics, telemetry inspection, event correlation, and recording. |
| **Transport selection** between standard X-Plane UDP and an optional native plugin. | **Replay and debrief** with JSON/CSV exports and offline Python-generated PDF or HTML reports. |

### Architecture

```mermaid
flowchart LR
    UI["React 19 · Desktop & Mobile"] <-->|WebSocket| API["NestJS 11 · Control & Telemetry"]
    API <-->|"X-Plane UDP · Default"| XP["X-Plane Simulator"]
    API <-->|"Authenticated UDP · Optional"| NATIVE["C++20 Native Plugin"]
    NATIVE <-->|XPLM SDK| XP
    UI -->|Record export| REPORT["Python · Offline Debrief"]
```

**Technology:** C++20 · X-Plane SDK · TypeScript · React 19 · Vite 7 · NestJS 11 · WebSocket · UDP · Python · CMake · pnpm.

## Getting started

**Requirements:** X-Plane, Node.js 24, pnpm 12, and a supported modern desktop browser. The native plugin is optional for the default UDP monitoring path.

```powershell
# Clone and install
git clone https://github.com/hwspen7/xplane-motion-controller.git
cd xplane-motion-controller
pnpm install
Copy-Item .env.example .env

# Build the shared package, web app, and server
pnpm build

# Start the application
pnpm start:server
```

Open **http://127.0.0.1:3000/?view=desktop** for the monitoring console. For development, run `pnpm dev:server` and `pnpm dev:web` in separate terminals.

The default configuration has `XPLANE_OUTPUT_ENABLED=false`. Monitoring can be used without enabling remote flight-control output. Review `.env.example` before configuring control or network access.

### Optional native plugin

The official X-Plane SDK must be downloaded separately. It is **not bundled** with this repository.

```powershell
# Point XPLANE_SDK_DIR to your extracted X-Plane SDK
cmake -S native/xplane-plugin -B build/native -A x64 -DXPLANE_SDK_DIR="C:/path/to/XPlaneSDK"
cmake --build build/native --config Release
```

Install the built `win.xpl` under `X-Plane 12/Resources/plugins/XPlaneMotionController/64/` on Windows. Place a `controller.conf` alongside the `64` directory using `native/xplane-plugin/config/controller.conf.example` as a reference. Set `XPLANE_TRANSPORT=native` and use the same randomly generated secret for `NATIVE_SHARED_TOKEN` and the plugin's `token` setting. Keep network bindings restricted to trusted hosts.

### iPhone controller

Motion-sensor access requires a secure browser context. On a trusted local network, configure HTTPS using:

```powershell
.\scripts\setup-iphone-https.ps1 -LanIp 192.168.1.10
```

Replace the example address with your computer's actual private LAN address, follow the script's certificate-trust instructions, and open the displayed `https://` URL in iPhone Safari. Control output remains disabled until explicitly configured.

### Flight debrief export

Use the recorder's **EXPORT PYTHON JSON** option, then generate an offline report:

```powershell
python -m pip install -r analysis/requirements.txt
python analysis/flight_report.py xplane-flight-record.python.json --output flight-report.pdf --html flight-report.html
```

## Verification

```powershell
pnpm typecheck
pnpm build
pnpm test

# Native core tests (the official SDK is not required for these)
cmake -S native/xplane-plugin -B build/native -A x64
cmake --build build/native --config Release
ctest --test-dir build/native -C Release --output-on-failure
```

GitHub Actions also checks the web/server workspace and native core tests on Windows, Linux, and macOS.

## License & safety

**Copyright © 2026 Spencer Qin.** Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Personal, educational, and other permitted noncommercial uses are subject to its terms. **Commercial use is not generally licensed** and requires separate authorization where applicable. This is a source-available, noncommercial project, not an OSI-approved open-source license.

This software is for **flight simulation only**. Its displays, diagnostics, and flight analysis are advisory, not certified for real-world aviation. X-Plane and associated trademarks belong to their respective owners. The project is not affiliated with or endorsed by Laminar Research.