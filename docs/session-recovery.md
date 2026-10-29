# Persistent pairing with fail-safe background behavior

This patch requires the preceding `native-observability` and `interruption-recovery` patches. Install it on the existing `feature/native-flight-observability` branch.

## Operational contract

- The iOS Safari background page **cannot** be guaranteed to retain its live WebSocket, motion sampling or timers. WebKit may suspend a background tab.
- On hidden or interrupted input, the C++ plugin issues the simulator pause request and drops flight control authority. The controller WebSocket may disconnect, but the *paired identity* is retained for 30 minutes in the NestJS process.
- A 256-bit random session ticket is issued only after successful pairing. The iPhone retains it in origin-scoped `localStorage`, not the URL. On visible return or fresh page reload, it reconnects and sends `rejoin` automatically.
- Server preserves the ticket across reconnects to tolerate lost acknowledgements, and refreshes its 30-minute inactivity expiry. If it expires, the server restarts, or Safari clears site storage, the pilot enters the pairing code again.
- A restored session is **not** active flight authority. Motion must be enabled and recentered. The pilot presses `ARM CONTROL`, waits for native ownership confirmation, and only then can press `RESUME FLIGHT`. No automatic unpause.
- The mobile panel displays `RECONNECTING` during connection recovery, and `SESSION RESTORED - RECENTER & ARM` after successful recovery without modal alerts.
- Manual `DISARM` remains a voluntary control release. Never treat an involuntary background disconnect as manual disarm.

## Verification

1. Start X-Plane with the latest C++ `win.xpl` built from the preceding interruption patch and start NestJS.
2. Pair once using the six-digit code. The browser then holds a temporary rejoin credential.
3. ARM on the ground. Switch to another app or simulate a phone call. Expect X-Plane to pause when the control stream stops.
4. Return to the same iPhone Safari tab. Expect automatic connection and `SESSION RESTORED - RECENTER & ARM`. If the browser discarded the page, motion permission may require a user gesture again.
5. Re-enable motion if necessary, RECENTER, ARM CONTROL, then explicitly RESUME FLIGHT.
6. Restart the backend or clear the site local storage and verify the UI requires the six-digit code again.
7. Verify an incorrect ticket is rejected, and that pairing a different controller invalidates the old ticket.

## Limitations

WebKit may leave WebSocket handshakes stuck on some iOS versions after backgrounding. The hook proactively replaces stale sockets and has a six-second handshake timeout and retry loop. If two handshakes hang after returning from the background but the local HTTPS server still responds, it automatically reloads the page at most once per minute to recover Safari's network stack. Reloading the page can require the pilot to tap ENABLE MOTION again. This cannot be fixed by keeping JavaScript awake in the background.

This patch changes the WebSocket/session code and the phone UI only: do not recompile or reinstall the C++ plugin, provided the preceding interruption patch's 5/5 native tests passed and its `win.xpl` is already installed.
