X-Plane Motion Controller / Ground Turn Arrow UI Patch

Only changes:
- apps/web/src/components/mobile/CompactFlightControls.tsx
- apps/web/src/styles/mobile-ground-turn-refinement.css
- apps/web/src/main.tsx

Replaces platform-dependent arrow emoji with crisp Lucide SVG arrows,
adds symmetric rounded arrow chips and pressed-state feedback.
Existing ground-only lock, hold-to-turn, and release-to-center logic remains unchanged.

Patch baseline: latest spacious-aircraft-flaps frontend patch.

Install: extract this ZIP over the repository root.
Build frontend from apps/web:
  .\node_modules\.bin\vitest.cmd run
  .\node_modules\.bin\tsc.cmd --noEmit
  .\node_modules\.bin\vite.cmd build

No C++ / plugin rebuild required.
