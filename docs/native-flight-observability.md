# Native Flight-Loop Observability

This stage builds on commit `e8b8bb5` on `main`. It is deliberately aircraft-agnostic and does not modify the fixed mobile roll/pitch mappings, pairing, the C++ ownership check, or either 350 ms watchdog.

## Real-time path

- iPhone sends orientation-based control samples to NestJS using authenticated WebSocket ownership.
- NestJS validates them and forwards numbered UDP control packets on localhost.
- The C++ plugin reads up to 32 packets per X-Plane flight-loop tick. It retains only the highest-sequence `CTRL` packet in each contiguous run. `ARM` and `DISARM` form hard barriers and discard pending control frames. `THROTTLE`/`ACTION` first flush pending control so their relative order is preserved.
- The C++ plugin alone reads/writes X-Plane DataRefs, manages pitch/roll overrides, and applies the existing 350 ms dead-man timeout.
- No filter, artificial delay, dynamic profile, extra thread, or cross-thread DataRef access is added.

## New native diagnostics

These fields are appended to the already authenticated `XMT1` telemetry snapshots, which remain at approximately 10 Hz:

| Wire field | Meaning |
| --- | --- |
| `nativeLoopHz` | Measured rate of X-Plane plugin flight-loop callbacks, not iPhone sampling rate |
| `nativeAppliedFrames` | Number of control frames accepted and written during the current ARM session |
| `nativeSkippedSeq` | Gaps between *applied* sequence IDs. Includes deliberate newest-frame coalescing and potentially network loss; cannot distinguish them |
| `nativeMaxGapMs` | Greatest observed elapsed time between native applied control frames, measured on the C++ monotonic clock |
| `nativeMaxApplyUs` | Maximum time inside the native `ControlSurface::apply()` call, in microseconds. Does not include aircraft physics/visual response |
| `nativeControlAgeMs` | Age since the last applied native control frame as of the telemetry snapshot |
| `nativeAckSeq` | Highest sequence applied to X-Plane's standard yoke DataRefs in this ARM session |

The backend additionally measures `feedbackRoundTripMs` using a single Node.js monotonic clock, from sending a numbered control packet to receiving telemetry acknowledging that sequence. The C++ telemetry is sampled at about 10 Hz, so this round-trip metric includes telemetry sampling delay and **is not true one-way phone-to-aircraft latency**. No unsynchronized iPhone/Windows or JS/C++ clock values are subtracted.

The desktop Connectivity & Input Health panel is read-only. Old native plugins that omit the new keys remain compatible, but the new metrics will display as unavailable until `win.xpl` is rebuilt and installed.

## Validation

1. Create the development branch locally from clean `main`.
2. Apply the source patch at the repository root.
3. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` on Windows.
4. With Visual Studio Developer PowerShell, build the native plugin using the same SDK and NMake configuration as before. Run `ctest --test-dir build/native-nmake --output-on-failure` (four native tests).
5. **Exit X-Plane** and copy the newly built `win.xpl` into the plugin's `64` directory. Keep `controller.conf` and the HTTPS certificates untouched.
6. Restart X-Plane, then NestJS. Verify native loop Hz and telemetry while disarmed. Arm only while stationary, check applied frames and feedback RTT, then DISARM. Confirm the controls return to neutral and the override is released.

These metrics support future performance optimization. They do not prove zero-latency flight response, which is physically unattainable.

## C++ ownership and the 40% codebase target

C++ owns time-sensitive simulator execution, frame coalescing, input validation, direct SDK data access, override arbitration, timeout protection, and native timing statistics. Node.js owns network session authentication, monitoring, and supervision. React is a display and sensor client. A 40% C++ source-code share is a **long-term codebase target**, not something to obtain by adding unused native code. Future native modules can include deeper control health instrumentation, unit-tested protocol parsers, and simulation-facing diagnostic adapters after measured need.
