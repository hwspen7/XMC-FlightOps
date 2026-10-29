# Complete Flight Controls — Incremental Update

This patch is based on the previously supplied Flight Sync + Handling state, with the interruption recovery and native observability updates installed. It is **not** a full replacement checkout. Apply only on `feature/native-flight-observability`, and preserve local `.env` and `controller.conf`.

## New native controls

- Rudder: X-Plane standard `sim/joystick/yoke_heading_ratio`, acquired through `override_joystick_heading` only on first rudder input. Aircraft-dependent nosewheel steering comes from the aircraft's own rudder/pedal mapping; this is **not** an independent nosewheel tiller.
- Brakes: held-left and held-right additional toe brake ratios, reset when the button is released, after 500 ms without a fresh brake packet, or on disarm/interruption.
- Forward throttle: continues using `throttle_ratio_all`. Reverse: `throttle_jet_rev_ratio_all`, written only when ground contact is confirmed and forward throttle is near idle. Releasing the spring-loaded reverse slider returns to zero. Aircrafts without this standard DataRef fail closed.
- Autopilot: the native plugin refuses ARM while `sim/cockpit2/autopilot/servos_on` reports active. When the AP becomes active during a mobile session, the plugin releases its override; the existing server interruption guard handles lost control. The pilot disengages the AP with the aircraft's controls. No aircraft-specific AP modes are overwritten.
- No additional smoothing, control-frame queue, or autopilot commands have been added. Existing roll and pitch polarity and calibration are unchanged.

## Mobile interface

The right-side flight-control area now includes a spring-centered RUDDER/ TAXI slider, a hold-to-brake button and spring-return reverse slider. A small RECORD/STOP REC/CSV group controls a bounded flight session recorder. Recording is controlled by the paired mobile pilot. CSV download is allowed only after DISARM; desktop monitoring remains read-only.

## Recording

NestJS records at most 10 samples/second and 18,000 rows (about 30 minutes), in memory only. The CSV includes timestamps, raw pilot commands, X-Plane aircraft telemetry, braking/reverse, autopilot state, simulator pause state and measured control acknowledgement round trip. It does not include passwords, pairing codes or native UDP tokens.

The monitor reports maximum absolute bank angle, vertical speed, IAS and average *acknowledgement round trip* (not one-way physical control latency). Approach consistency is an informational fraction of eligible samples at 100–1000 ft AGL, at least 60 kt IAS, bank within 10° and vertical speed within 1000 fpm. It is not an aircraft-specific operational assessment or a landing score.

## X-Plane mouse-yoke square

The white rectangle is X-Plane's **built-in mouse yoke**, not our phone UI. The native `sim/joystick/mouse_is_joystick` status is read-only, and `sim/graphics/view/hide_yoke` hides the **3D cockpit control column**, NOT this mouse rectangle. We deliberately never change those DataRefs to pretend the square was hidden.

Our C++ plugin detects the optional `FlyWithLua/SimpleMouseYoke/HideMouseYoke` command. If present, it calls it on successful mobile ARM. It calls the corresponding Show command on DISARM only if the mouse-yoke was active when it was acquired. You can install a compatible external **Simple Mouse Yoke** script for FlyWithLua from its original project if you want this integration. Without that third-party command, the UI reports `MOUSE HIDE SUPPORT: NOT INSTALLED` and native control still functions. Do not install unrelated plugins just to suppress the square if they conflict with your aircraft.

## Build and install on Windows

Run these from `E:\Personal_Project\xplane-motion-controller` in the project branch:

```powershell
Expand-Archive -LiteralPath "E:\xplane-motion-controller-complete-flight-controls-patch.zip" -DestinationPath (Get-Location).Path -Force
pnpm --filter @xplane/shared build
pnpm --filter @xplane/server test
pnpm --filter @xplane/web test
pnpm --filter @xplane/server build
pnpm --filter @xplane/web build
```

Then from the Visual Studio Developer PowerShell environment (with your existing CMake executable and `XPLANE_SDK_DIR` configuration):

```powershell
& $cmake -S native/xplane-plugin -B build/native-nmake -G "NMake Makefiles" -DXPLANE_SDK_DIR="E:/Personal_Project/XPlaneSDK" -DBUILD_TESTING=ON
& $cmake --build build/native-nmake
& $ctest --test-dir build/native-nmake --output-on-failure
```

Close X-Plane before copying the new `build\native-nmake\win.xpl` into your existing X-Plane plugins path. Restart X-Plane and the NestJS HTTPS backend. Perform the first test on the ground with the parking brake set and engines idle. Do not replace any local secrets.

## Acceptance checks

1. Normal roll/pitch and pause/rejoin remain unchanged.
2. Rudder returns to center and its X-Plane feedback moves; for aircraft without coupled nosewheel steering, rudder will not act as an independent tiller.
3. Holding the brake applies brake pressure. Release or interruption clears commanded toe-brake pressure.
4. Reverse requires verified ground status and throttle idle, remains zero in flight, and returns to zero on release.
5. With AP on, no manual ARM/override conflict occurs; with AP activated while mobile is active, the native override releases and the interruption logic protects the aircraft.
6. Record, stop, disarm, export CSV; compare X-Plane values to the monitor. Flight records are lost when the server is restarted before export.
7. Check `MOUSE HIDE SUPPORT`. If unavailable, no promise is made that the built-in white square will disappear.

This software is only for a flight simulator and must not be used for real aviation control.
