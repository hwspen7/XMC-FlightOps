XMC Landscape Right-Side Width Expansion (CSS-only behavior)

Files:
  apps/web/src/main.tsx
  apps/web/src/styles/mobile-width-expansion.css

Purpose:
  Reclaim up to 32 CSS pixels of the excessive right-hand landscape safe-area
  inset. Left safe-area stays unchanged. The existing three-column grid keeps
  its ratios and expands naturally into the reclaimed space.

No changes to flight controls, gestures, throttle, PFD telemetry, or native code.

Apply by extracting this ZIP into the repository root. Do not extract into
apps/web. If you have changed main.tsx yourself, add only the final CSS import
from this patch instead of overwriting that file.

Build with the commands known to work on Windows:
  cd packages/shared
  .\node_modules\.bin\tsc.cmd -p tsconfig.json
  cd ..\..\apps\web
  .\node_modules\.bin\vitest.cmd run
  .\node_modules\.bin\tsc.cmd --noEmit
  .\node_modules\.bin\vite.cmd build

This patch does not require recompiling the X-Plane native plugin.
