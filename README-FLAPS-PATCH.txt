X-Plane Motion Controller - Spacious Aircraft Flaps Panel Patch

Apply at the repository root. This incremental patch updates only the flap
rendering, aircraft-specific detent label configuration, and adds a small
additive CSS file. Does not replace flight-deck.css or mobile-controls.css.

Included files:
- apps/web/src/components/mobile/CompactFlightControls.tsx
- apps/web/src/components/mobile/flapProfiles.ts
- apps/web/src/components/mobile/flapProfiles.test.ts
- apps/web/src/styles/mobile-flaps-spacious.css
- apps/web/src/main.tsx

Behavior:
- Selected detent comes from X-Plane flap handle request telemetry.
- Surface percentage comes from X-Plane flap system deployment telemetry.
- Common Boeing, Airbus and C172 detent labels require a compatible X-Plane
  configuration count. Unmatched aircraft display generic POS labels instead.
- No data means placeholders only. No guessing of the active aircraft.
- UP retracts one configured detent; DN extends one configured detent.
- Buttons are disabled when control is inactive; configured end-detents are
  respected. Missing detent metadata does not prevent X-Plane step commands.
- The display is a readable gauge, not an independent continuously draggable
  actuator; input remains the existing incremental X-Plane commands.

Test/build on Windows PowerShell:
  cd E:\Personal_Project\xplane-motion-controller\packages\shared
  .\node_modules\.bin\tsc.cmd -p tsconfig.json
  cd ..\..\apps\web
  .\node_modules\.bin\vitest.cmd run
  .\node_modules\.bin\tsc.cmd --noEmit
  .\node_modules\.bin\vite.cmd build

This patch changes frontend code only. No native plugin rebuild required,
provided the latest flap telemetry (aircraftIcao, flapDetentCount,
flapHandleRatio, flapDeployRatio) is already installed.
