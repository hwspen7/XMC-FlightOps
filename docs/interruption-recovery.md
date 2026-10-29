# Interruption-safe motion control

This patch distinguishes intentional DISARM (releases aircraft axes) from a
temporary interruption (SUSPEND, releases axes and pauses the simulator).

- iOS Safari `visibilitychange` / `pagehide` sends SUSPEND, not DISARM.
- NestJS sends SUSPEND on websocket loss or controller inactivity.
- X-Plane C++ watchdog also pauses on lost control frames, even if the browser
  or backend cannot deliver SUSPEND. The previous 350 ms watchdog stays intact.
- The plugin reads `sim/time/paused` (read-only) and calls the official
  `sim/operation/pause_toggle` command only when currently unpaused. It records
  whether it initiated that pause and never resumes a user/manual pause.
- Returning to Safari does **not** unpause. Enable sensors if necessary,
  RECENTER, ARM CONTROL with the pairing code, then press RESUME FLIGHT.
  Resume is accepted only with fresh input and confirmed native authority.
- Mobile notifications are placed in a compact non-modal status line and expire.

The native pause behavior requires the X-Plane plugin transport. Legacy UDP
control retains existing emergency disarm behavior but cannot reliably perform
an ownership-safe simulator pause.

## Verification checklist

1. Start on the ground, ensure X-Plane is running (unpaused).
2. Enable phone sensors, RECENTER, ARM. Confirm actual control movement.
3. Switch to another iPhone app or lock the phone. Confirm native `simPaused=1`,
   `nativeInterrupted=1`, and that the aircraft stops simulating.
4. Return to Safari, RECENTER and ARM. The plane must remain paused.
5. Press RESUME FLIGHT once. Check it resumes and remains controllable.
6. Press ordinary DISARM while flying: axes release, simulator does not pause.
7. Manually pause in X-Plane, then interrupt: the plugin must not unpause it.
8. Force-close Safari or sever Wi-Fi while armed: native watchdog must pause.

The first interrupted cycle should be tested in a parked aircraft. A remote
phone interruption is not guaranteed to be noticed by Safari before it is
suspended; the independent native watchdog is the important safety fallback.
