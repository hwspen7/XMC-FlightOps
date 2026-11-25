# Flight reconstruction validation protocol

The following checks are required before merging the flight reconstruction branch. This is simulator research tooling, not certified flight instrumentation.

## Automated
- pnpm typecheck
- pnpm build
- pnpm test
- Native core tests on Windows, Linux, macOS
- Flight package tests: unique ordered samples, pre-roll, compression, source-clock gaps, pause handling, checksum mutation rejection, streaming segment import
- Numerical tests: known control step overshoot, gain/phase/coherence benchmark, antimeridian and runway station, event bracketing and missing-signal rejection

## Actual X-Plane acceptance (not replaceable by synthetic unit tests)
1. Build and install the revised native plugin using the official SDK. Configure native transport with the existing paired controller and local network restrictions.
2. Start the server, connect X-Plane, complete a short flight (stationary preparation, taxi, takeoff, climb, level segment, descent, landing, taxi to stop). Do not rely on simulator data as an external ground truth for actual aircraft.
3. Confirm source timestamps and sequence increase; verify no duplicate archive rows, inspect missing packet count and effective rate, and compare recorded event brackets against simulator replay.
4. Open the finalized gzip file in Flight Reconstruction. Check 2D track, map, WebGL orbit, current attitude and controls at the same sample. Inspect missing channels and gaps; do not fill missing values with inferred physical sensors.
5. Import the simulator apt.dat; select a touchdown or liftoff event and match the runway. Confirm physical endpoints, heading, displaced threshold and reference-point distance against known scenery geometry.
6. For a second controlled test flight, use a suitable aircraft and deliberately record manual input steps and broadband commands in a safe simulated configuration; compare known reference step/readback timing and repeatability. Do not infer aircraft stability margins from arbitrary closed-loop manual data.
7. Conduct a long-duration session and verify disk usage, memory, recovery after connection loss and time-segment import. Confirm raw archive is retained if compression fails.

Record aircraft, plugin build, simulator version, transport, measured capture cadence, data coverage, test duration, and observed discrepancies. CI green alone is insufficient to claim physical-model accuracy.
