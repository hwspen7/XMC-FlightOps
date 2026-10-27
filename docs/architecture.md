# System Architecture

The project separates active mobile flight control from read-only desktop telemetry. Both views use shared WebSocket transport types, but only the armed phone instance may send accepted control frames.

## Signal paths

```text
Phone motion sensors -> Quaternion reference -> Yoke normalization
   -> WebSocket /control -> NestJS ControlService -> UDP DREF -> X-Plane

X-Plane -> UDP RREF telemetry -> XPlaneService -> WebSocket status
   -> DesktopMonitor -> 3D pose / 2D trends / system diagnostics
```

### Core responsibilities

- `YokeController` applies a calibration quaternion, exponential response, configurable dead zone, and time-based smoothing.
- `useDeviceOrientation` requests browser sensor permission and processes continuous orientation events. Motion permission can be unavailable in desktop browsers.
- `ControlService` validates monotonic packet sequence numbers, sole ownership, frame bounds, input rate, throttle and whitelisted commands. It disarms after 350 ms of missing control frames.
- `XPlaneService` owns UDP subscriptions and writes. It returns `null` for individual stale or unsupported fields.
- `ControlGateway` distributes status snapshots to all connected viewers but accepts flight commands only from the armed controller.
- `useTelemetryHistory` stores a bounded history in the desktop browser; charts never create synthetic data when disconnected.

### Flight data

Common simulator parameters are registered in `apps/server/src/xplane/telemetry.ts`. Each mapping contains an index, dataref path, scalar factor, and request frequency. The simulator may not implement every dataref. To extend support, add mappings and update `FlightTelemetry` and the desktop UI; do not hardcode aircraft telemetry or treat a missing dataref as zero.

### View design

- `MobileCockpit` is a purpose-built phone landscape touch interface around motion control; it has no touch joystick.
- `DesktopMonitor` is a read-only observation surface and never renders control-authorization buttons.
- `AttitudeModel3D` performs three-axis rotations of a local plane schematic and projects it with perspective using SVG. This is a 3D mathematical visualization, not photorealistic 3D rendering.
- `GroundTrack` approximates local east/north distance from geographic coordinates. It is a small-area situational plot, not a routing or navigation system.

### Safety model

A six-digit pairing code gates control ownership. Simulator output is disabled by default, with an explicit environmental setting needed to activate it. Auxiliary commands are individually allowlisted. Stale inputs and lost WebSocket ownership release local override state; an independently lost UDP release packet cannot be reliably acknowledged without a dedicated simulator plugin. Do not assume absolute failsafe behavior.
