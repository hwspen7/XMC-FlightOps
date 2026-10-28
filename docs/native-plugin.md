# Native X-Plane Plugin

This optional C++20 plugin runs inside X-Plane and exposes authenticated, IP-filtered local UDP control and telemetry to the NestJS bridge. It is independent of the iPhone/React interface and does not require Python.

## What it supports

- X-Plane SDK DataRef access from the flight-loop thread.
- Roll and pitch yoke ratio writes with separate pitch/roll joystick override ownership checks. Other joystick axes remain under their original input system.
- Flight telemetry: 27 aircraft measurements, transmitted as a complete snapshot at approximately 10 Hz (dependent on X-Plane frame rate).
- Throttle command and an explicit allowlist of auxiliary simulator commands.
- Strict input bounds, monotonic frame sequence, and a 350 ms controller dead-man timer.
- A shared secret and fixed peer IP filter; networking fails closed if configuration is absent or invalid.
- Automatic release of joystick override on disable, stop or input timeout.

DataRef availability depends on the aircraft, X-Plane version and installed addons. Missing parameters are omitted and display as unavailable. The plugin does not supply third-party proprietary avionics DataRefs.

## Build on macOS

Install CMake and a C++ compiler (Apple Command Line Tools or Xcode), then download the latest official SDK from:

https://developer.x-plane.com/sdk/plugin-sdk-downloads/

Extract the SDK. Locate the directory that contains `CHeaders` and `Libraries`; this is the value for `XPLANE_SDK_DIR`.

```bash
cmake -S native/xplane-plugin -B build/native \
  -DXPLANE_SDK_DIR="/path/to/SDK" \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build/native --config Release
ctest --test-dir build/native --output-on-failure
```

The plugin target produces `mac.xpl`. The target architecture must match the installed X-Plane app. For Apple Silicon use an ARM64 build when X-Plane is running natively; for Intel use x86_64. Run-time plugin compilation requires the official SDK; the C++ unit tests build without it.

## Build on Windows

Use Visual Studio with C++ build tools and CMake. Configure from a Developer PowerShell:

```powershell
cmake -S native/xplane-plugin -B build/native -A x64 -DXPLANE_SDK_DIR="C:/path/to/SDK"
cmake --build build/native --config Release
ctest --test-dir build/native -C Release --output-on-failure
```

The output is `win.xpl`. Windows needs the SDK's `XPLM_64.lib` at build time; the shipped X-Plane runtime supplies the plugin host.

For Linux, build with GCC/Clang and the SDK headers; the output is `lin.xpl`. Linux resolves SDK symbols from X-Plane when the plugin loads.

## Install the plugin

Create this folder under your X-Plane installation:

```text
X-Plane 12/
  Resources/
    plugins/
      XPlaneMotionController/
        controller.conf
        64/
          mac.xpl      # macOS
          win.xpl      # Windows
          lin.xpl      # Linux
```

Install **only the binary for the operating system running X-Plane**. Restart X-Plane after installing or replacing the plugin. On macOS, review the relevant app/security permissions if the locally built binary is blocked.

Copy `native/xplane-plugin/config/controller.conf.example` to `controller.conf` under the plugin directory. Replace the example token with a random secret generated on the NestJS machine:

```bash
openssl rand -hex 24
```

The token must be 16 to 128 characters using letters, digits, `_` or `-`. Do not commit the real token or `controller.conf` to Git.

## Same-computer setup

Use this in the plugin's `controller.conf`:

```ini
# Do not commit your real shared secret.
token=REPLACE_WITH_YOUR_GENERATED_SECRET
bind_address=127.0.0.1
peer_address=127.0.0.1
listen_port=49051
telemetry_port=49052
```

In the NestJS project's `.env`:

```dotenv
XPLANE_TRANSPORT=native
XPLANE_HOST=127.0.0.1
NATIVE_SHARED_TOKEN=REPLACE_WITH_YOUR_GENERATED_SECRET
NATIVE_PLUGIN_PORT=49051
NATIVE_LISTEN_HOST=127.0.0.1
NATIVE_LISTEN_PORT=49052
XPLANE_OUTPUT_ENABLED=false
```

Start X-Plane first, then start NestJS. Confirm the desktop monitor reads real flight data before enabling output.

## Split Mac/Windows setup

If NestJS runs on the Mac and X-Plane runs on Windows, use actual private IPv4 addresses:

- In Windows `controller.conf`, set `bind_address` to the Windows LAN IPv4 address and `peer_address` to the Mac LAN IPv4 address.
- In Mac `.env`, set `XPLANE_HOST` to the Windows LAN IPv4 address and `NATIVE_LISTEN_HOST=0.0.0.0`.
- Keep the control and telemetry ports at 49051 and 49052 unless changed consistently on both computers.
- Allow inbound UDP 49051 on Windows **only from the Mac**, and inbound UDP 49052 on the Mac **only from Windows**. Restrict both firewalls to the private network.
- Use the same strong token in both configuration files, and keep both computers on a trusted network.

The UDP protocol is authenticated with a shared token and source IP check, but **not encrypted**. Do not expose these ports to the public internet or an untrusted LAN. A VPN or encrypted tunnel is required for untrusted networks.

## Control and telemetry protocol

The packets are ASCII encoded and intentionally lightweight. The public transport is not a general API; only the NestJS bridge should transmit control packets.

```text
XMC1|<token>|ARM
XMC1|<token>|CTRL|<sequence>|<roll>|<pitch>
XMC1|<token>|DISARM
XMC1|<token>|THROTTLE|<ratio>
XMC1|<token>|ACTION|<allowlisted-action>
XMT1|<token>|armed=<0-or-1>|rollDegrees=...|pitchDegrees=...|...
```

Control limits are `-1..1` for pitch and roll and `0..1` for throttle. The plugin handles networking with a nonblocking socket during X-Plane's flight-loop callback. XPLM DataRef access does not occur on a separate networking thread.

## Safety and troubleshooting

- The browser pairing code and the native shared secret are separate credentials. The native secret must never be embedded in the browser bundle.
- Setting `XPLANE_OUTPUT_ENABLED=false` allows read-only native telemetry; the backend will not send native ARM/CTRL packets.
- The plugin refuses to acquire either pitch or roll override when another plugin owns it. Avoid running competing flight-control plugins or input overrides.
- Loss of controller frames releases override after 350 ms while X-Plane's flight loop is running; no hard real-time guarantee is made when X-Plane is paused or stalled.
- Network packets are unacknowledged UDP datagrams. The desktop dashboard reports latest received plugin state; it cannot guarantee that an individual action took effect.
- Throttle changes may persist after disarming; do not assume all aircraft systems return to their previous state.
- If X-Plane is not detected, verify token, peer IP, UDP firewall ports, simulator/plugin load status, and the plugin log in `Log.txt`.
- Check axis polarity with a default aircraft on the ground before making any flight-control output live. Third-party aircraft may override standard datarefs.
- To return to the previous transport, set `XPLANE_TRANSPORT=udp` and restart NestJS. Do not activate both transports simultaneously.

The plugin has been compiled against minimal test SDK stubs for syntax checks and its protocol/control unit tests can run without X-Plane. A genuine X-Plane SDK build and a flight test must still be carried out on the target computer.
