# XPlane Motion Controller

A modular flight-simulator control and monitoring workspace. An iPhone acts as a motion-controlled yoke, while the desktop is a read-only flight-monitoring station with live X-Plane 12 telemetry, 2D charts, a 3D aircraft attitude schematic, and device diagnostics.

This is an independent project with a Boeing 787-inspired visual language. It is neither affiliated with Boeing nor a certified flight instrument.

## Applications

### Mobile cockpit

Open on an iPhone in landscape orientation. The screen is a control panel, **not a touch joystick**. Roll and pitch commands come from physical phone motion using a quaternion-relative neutral reference.

The interface includes:

- Primary motion-attitude reference with blue/brown horizon, pilot-aligned reference marker and input-axis bars.
- Airliner, regional, and light-aircraft response presets. Preset changes are locked while armed.
- Throttle command slider and flight-control buttons for pitch trim, flaps, spoilers, and landing gear.
- Recenter, motion permission, pairing, arm/disarm, and connection health.
- A dedicated setup panel for response curve, travel, dead zone, damping, and axis inversion.

Secondary buttons and throttle transmission require an armed controller, enabled simulator output and active simulator telemetry. They are disabled otherwise. The throttle slider controls all engine levers together and may be overridden by aircraft automation or other devices. A command request is **not** a guarantee that a third-party aircraft accepted it.

### Desktop monitoring

The desktop view is **read only**. It never sends flight-control commands. It provides:

- Primary flight display using simulator-derived attitude, airspeed, altitude, vertical speed and heading.
- Perspective 3D airplane schematic based on aircraft roll, pitch, and heading.
- Independent 2D charts for airspeed, aircraft attitude, altitude, vertical speed and normalized phone input.
- 2D ground-track history projected from latitude and longitude.
- Grouped flight-dynamics, navigation, air-data, engine and flight-control readouts.
- UDP heartbeat age, active dataref count, server link, phone ownership, input frequency, sensor frequency, frame age and watchdog state.

The server requests **27 flight datarefs plus one simulator heartbeat**. This covers common flight parameters, not every dataref or third-party avionics system available in X-Plane. Additional aircraft-specific datarefs can be added to `apps/server/src/xplane/telemetry.ts`. Unsupported or stale fields show `---`, not invented numbers. The 3D display is a geometric schematic, not an exact Boeing aircraft model.

## Development requirements

- Node.js 24 LTS
- pnpm 12
- macOS for local development
- iPhone Safari for physical motion control
- X-Plane 12 running on a network-reachable Mac or Windows computer

## Install

```bash
pnpm install
pnpm test
pnpm build
```

If `pnpm` asks to approve additional package build scripts, review the package identities before allowing them. The workspace already includes `allowBuilds: esbuild: true` for the Vite toolchain.

Make a copy of the default environment file only on first installation:

```bash
cp .env.example .env
```

### Updating an existing project

Preserve the existing `.git`, `.env`, local certificates, existing `node_modules` and lockfile. Extract this source bundle to a temporary directory and synchronize its root into your existing project. For example, from the existing project directory:

```bash
SOURCE_DIR="$(mktemp -d)"
unzip -q ~/Downloads/xplane-motion-controller.zip -d "$SOURCE_DIR"
rsync -av --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env' \
  --exclude='certs/' \
  --exclude='pnpm-lock.yaml' \
  "$SOURCE_DIR/xplane-motion-controller/" ./
pnpm install
pnpm test
pnpm build
```

Do not use `git push --force`. Inspect `git diff` before creating a commit.

## Choose the view

The site automatically selects the mobile cockpit for phones and the desktop monitor for desktop browsers. Explicit overrides are available:

- `?view=mobile` — mobile cockpit preview or operation.
- `?view=desktop` — desktop telemetry monitor.

The interface also provides a view toggle. Switching to mobile view on a laptop does not create phone-motion sensors.

## Local development

Start the backend and the frontend in separate terminal sessions:

```bash
pnpm dev:server
pnpm dev:web
```

The Vite development site defaults to `http://127.0.0.1:5173`, with a WebSocket proxy to NestJS at `http://127.0.0.1:3000`. The desktop monitor can be viewed without phone sensors or X-Plane. Without real simulator data, its flight instruments and plots remain empty.

## Trusted HTTPS for the iPhone

Safari requires a trustworthy origin for device motion access. For LAN testing on a Mac, a practical approach is `mkcert`:

```bash
brew install mkcert
mkcert -install
ipconfig getifaddr en0
```

Substitute the actual Mac LAN address for the example when generating certificates:

```bash
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 192.168.1.100
```

Use `mkcert -CAROOT` to locate `rootCA.pem`. Transfer **only the root certificate**, not the private key, to your own iPhone and enable full certificate trust in iOS Settings. The certificate for your server must include the actual address you use to connect.

Example `.env` (replace the example addresses):

```dotenv
HOST=0.0.0.0
PORT=8443
TLS_CERT_FILE=certs/cert.pem
TLS_KEY_FILE=certs/key.pem
XPLANE_OUTPUT_ENABLED=false
XPLANE_HOST=192.168.1.200
XPLANE_PORT=49000
XPLANE_PROBE_ENABLED=true
```

The Mac address belongs in the Safari URL. The X-Plane computer's address belongs in `XPLANE_HOST`. They can be the same computer. X-Plane must be running and UDP port `49000` reachable from the server (firewall rules may apply).

```bash
pnpm build
pnpm start:server
```

Open `https://<MAC_IP>:8443` in iPhone Safari. In mobile view, enable motion access from a user gesture, rotate to landscape, hold the phone naturally, select Recenter, enter the pairing code printed by NestJS, and arm when ready.

## Safe first flight test

1. Keep `XPLANE_OUTPUT_ENABLED=false` for initial motion and telemetry checks.
2. Verify the response sign and range of both axes while moving the phone.
3. Start X-Plane with a simple default aircraft and test in a safe, paused or ground scenario.
4. Enable output explicitly in `.env` and restart NestJS.
5. Confirm that arming, disarming, and the 350 ms dead-man timeout release simulator axis override.
6. Check trim, flaps and throttle with the loaded aircraft. Some third-party aircraft use custom commands and datarefs.

UDP is not a guaranteed-delivery protocol. A lost override-release packet can leave an override active; if control authority does not return to normal, restart X-Plane or manually clear the joystick override. Do not rely on this system in real aircraft.

## Architecture

```text
apps/
  web/src/
    components/mobile/     Motion horizon, flight buttons, setup drawer
    components/monitor/    3D attitude, charts, track, data tables, diagnostics
    controllers/           Sensor-to-yoke response model
    hooks/                 Orientation, control, history, view routing
    motion/                Quaternion mathematics
    network/               WebSocket client and reconnect handling
    styles/                Cockpit and monitoring design system
    views/                 MobileCockpit and DesktopMonitor
  server/src/
    configuration/         Environment settings
    control/               Arm ownership, actions, watchdog
    transport/             WebSocket gateway
    xplane/                UDP RREF/DREF/CMND, telemetry subscriptions
packages/shared/src/      Shared protocol and telemetry contracts
docs/                     Engineering design reference
```

## Known limitations

- No X-Plane hardware integration was physically tested when this archive was prepared. Verify simulator dataref compatibility with your installation.
- The 3D model is a basic geometry projection driven by simulator attitude, not a navigationally correct scene or manufacturer-specific airframe mesh.
- The dashboard keeps approximately 90 seconds of in-browser chart history and does not persist telemetry.
- The control backend uses the standard simulator UDP dataref/command interface, not a third-party aircraft SDK. Some custom avionics and FBW implementations may not respond.
- The iPhone device-orientation mapping must be verified with a physical phone in landscape mode, and axis inversion may need adjustment for personal grip.
- Sidestick remains a separate planned control mode, not a disguised Yoke preset.
