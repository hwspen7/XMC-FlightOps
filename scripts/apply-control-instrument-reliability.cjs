'use strict';
/*
 * Safe, checked, idempotent overlay for an existing customized XMC tree.
 * Dry-run every source transformation before touching disk. The patch expects
 * the previously installed super-monitor and precision-attitude releases.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const marker = 'XMC_CONTROL_INSTRUMENT_RELIABILITY_20261029';
const plans = [];
function stage(relative, edit) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`Required project source missing: ${relative}`);
  const original = fs.readFileSync(target, 'utf8');
  if (original.includes(marker)) { console.log(`ALREADY UPDATED: ${relative}`); return; }
  let updated = original.replace(/\r\n/g, '\n');
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  function once(search, replacement, why) {
    const matches = typeof search === 'string'
      ? updated.split(search).length - 1
      : [...updated.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : search.flags + 'g'))].length;
    if (matches !== 1) throw new Error(`${relative}: ${why} expected once, found ${matches}; no files changed`);
    updated = updated.replace(search, replacement);
  }
  edit({ once, get: () => updated });
  updated = `/* ${marker} */\n` + updated;
  const final = newline === '\r\n' ? updated.replace(/\n/g, '\r\n') : updated;
  plans.push({ target, relative, original, final });
}

stage('apps/server/src/control/control.service.ts', ({ once }) => {
  once("import { XPlaneService } from '../xplane/xplane.service';",
    "import { XPlaneService } from '../xplane/xplane.service';\nimport { LatestThrottleQueue } from './latestThrottleQueue';",
    'throttle queue import');
  once('  private lastThrottleAt = 0;',
    '  private readonly throttleQueue = new LatestThrottleQueue(95);',
    'remove discard-only server throttle interval');
  once(/  throttle\(client: object, value: unknown\): boolean \{[\s\S]*?\n  \}\n\n  auxiliary\(/,
`  throttle(client: object, value: unknown): boolean {
    if (!this.isOwner(client) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return false;
    if (this.simulator.status().telemetry.autothrottleOn === 1) return false;
    // Subsequent slider updates supersede pending inputs instead of being
    // silently lost. Idle is immediate. Every delayed write rechecks authority.
    return this.throttleQueue.offer(value, () => {
      if (!this.isOwner(client)) return false;
      const status = this.simulator.status();
      if (!status.reachable || status.telemetry.autothrottleOn === 1) return false;
      if (!this.simulator.throttle(value)) return false;
      this.throttleCommand = value;
      this.lastAction = 'throttle';
      this.lastActionAt = Date.now();
      return true;
    });
  }

  auxiliary(`, 'replace discard-only throttle forwarding');
  once('    this.sequence = -1;\n    this.lastAcceptedAt = 0;',
    '    this.sequence = -1;\n    this.throttleQueue.reset();\n    this.lastAcceptedAt = 0;', 'reset pending queue on ARM');
  once('  private clearOwner(): void {\n',
    '  private clearOwner(): void {\n    this.throttleQueue.reset();\n', 'cancel queue on lost ownership');
});

stage('apps/web/src/components/mobile/ThrottleLever.tsx', ({ once }) => {
  once('now - current.at >= 65', 'now - current.at >= 95', 'match server throttle cadence');
  once('  const maxReverseLatched = useRef(false);',
    '  const maxReverseLatched = useRef(false);\n  const lastForwardGestureAt = useRef(0);', 'track local gesture for telemetry echo');
  once('  const forwardCommand = (value: number, force = false) => {\n    const now = performance.now();',
    '  const forwardCommand = (value: number, force = false) => {\n    const now = performance.now();\n    lastForwardGestureAt.current = now;', 'prevent stale telemetry overriding lever immediately');
  once(/  useEffect\(\(\) => \{\n    if \(dragging \|\| !live\) return;[\s\S]*?\n  \}, \[actual, reverseActual, dragging, live\]\);/,
`  useEffect(() => {
    if (dragging || !live) return;
    const applyReadback = () => {
      if (drag.current) return;
      if (reverseActual !== null) {
        const next = fractionForReverse(reverseActual);
        positionRef.current = next;
        setPosition(next);
      } else if (actual !== null) {
        const next = fractionForForward(actual * 100);
        positionRef.current = next;
        setPosition(next);
      }
    };
    // Wait for a later telemetry sample, but never leave an unconfirmed
    // command visually latched. Resync even if readback did not change.
    const wait = 350 - (performance.now() - lastForwardGestureAt.current);
    if (wait > 0) {
      const timer = window.setTimeout(applyReadback, wait);
      return () => window.clearTimeout(timer);
    }
    applyReadback();
  }, [actual, reverseActual, dragging, live]);`, 'reconcile lever with simulator readback after brief acknowledgement window');
  once("      {autothrottle ? 'AUTOTHROTTLE' : !active ? 'MONITOR ONLY'",
    "      {autothrottle ? 'AUTOTHROTTLE · THR LOCKED' : !live ? 'WAITING FOR SIM DATA' : !active ? 'ARM / VERIFY CONTROL'",
    'explain throttle lockout rather than silent disable');
});

// Radio-altitude readout is a contextual number, not a flag drawn over the
// moving attitude grid. Place it in reserved non-moving instrument footer.
stage('apps/web/src/components/mobile/B787PrimaryFlightDisplay.tsx', ({ once }) => {
  once(/\s*\{radioAltitudeFeet\(telemetry\.aglFeet,live\) !== null && <g aria-label="Radar-height indication from X-Plane AGL">[\s\S]*?<\/g>\}/,
    '', 'remove RA overlay from pitch ladder');
  once('<text x="579" y="334" fill="#70cef7" fontSize="9">M</text>',
    '<text x="553" y="334" fill="#70cef7" fontSize="9">M</text>', 'compact Mach label');
  once('<text x="579" y="353" fill="#e6faff" fontSize="13">{fmt(telemetry.machNumber,live,2)}</text>',
    `<text x="553" y="353" fill="#e6faff" fontSize="13">{fmt(telemetry.machNumber,live,2)}</text>
      {radioAltitudeFeet(telemetry.aglFeet, live) !== null && <g aria-label="X-Plane AGL below 2500 feet; advisory not certified radio altimeter">
        <text x="591" y="334" fill="#70cef7" fontSize="9">AGL FT</text>
        <text x="591" y="353" fill="#f4efd0" fontSize="13" fontWeight="800">{radioAltitudeFeet(telemetry.aglFeet, live)}</text>
      </g>}`, 'show AGL in footer separate from pitch marks');
});

stage('apps/web/src/components/monitor/FlightDisplay.tsx', ({ once }) => {
  once(/\s*\{radioAltitudeFeet\(telemetry\.aglFeet,live\) !== null && <g aria-label="Radar-height indication from X-Plane AGL">[\s\S]*?<\/g>\}/,
    '', 'remove desktop RA overlay over attitude ladder');
  once('          <rect x="265" y="330" width="230" height="64"',
    `          {radioAltitudeFeet(telemetry.aglFeet, live) !== null && <g aria-label="X-Plane AGL below 2500 feet">
            <rect x="507" y="330" width="104" height="29" rx="3" fill="#0a1d2d" stroke="#75bdcf"/>
            <text x="559" y="348" textAnchor="middle" fill="#d7eef6" fontSize="12" fontWeight="750">AGL {radioAltitudeFeet(telemetry.aglFeet, live)} FT</text>
          </g>}
          <rect x="265" y="330" width="230" height="64"`, 'desktop AGL outside attitude clip');
});

stage('apps/web/src/components/mobile/MotionAttitude.tsx', ({ once }) => {
  once(/\s*\{radioAltitudeFeet\(telemetry\.aglFeet,live\) !== null && <g><rect x="216" y="274"[\s\S]*?<\/g>\}/,
    '', 'remove mobile round attitude RA overlay');
  once('        <g transform="translate(180 10)">',
    `        {radioAltitudeFeet(telemetry.aglFeet, live) !== null && <g aria-label="X-Plane AGL in feet">
          <rect x="244" y="5" width="106" height="24" rx="4" fill="#081c2a" stroke="#7bc9dd"/>
          <text x="297" y="21" fill="#e0f8ff" textAnchor="middle" fontSize="12" fontWeight="800">AGL {radioAltitudeFeet(telemetry.aglFeet, live)} FT</text>
        </g>}
        <g transform="translate(180 10)">`, 'round attitude label outside pitch circle');
});

stage('apps/web/src/components/monitor/ProfessionalDashboard.tsx', ({ once, get }) => {
  if (!get().includes('radioAltitudeFeet')) throw new Error('Professional dashboard missing shared AGL helper');
  once('    <rect x="121" y="225" width="158" height="27"',
    `    {radioAltitudeFeet(t.aglFeet, live) !== null && <g aria-label="X-Plane AGL below 2500 feet">
      <rect x="283" y="227" width="105" height="23" rx="4" fill="#0a1d2d" stroke="#6bbacc"/>
      <text x="336" y="243" fill="#e4f5fd" textAnchor="middle" fontSize="11" fontWeight="800">AGL {radioAltitudeFeet(t.aglFeet, live)} FT</text>
    </g>}
    <rect x="121" y="225" width="158" height="27"`, 'compact dashboard footer AGL');
});

// Optional C++ diagnostics: log only transitions to native throttle rejection.
// Never change the established aircraft control or watchdog behavior.
stage('native/xplane-plugin/src/plugin.cpp', ({ once }) => {
  once('bool mouse_hidden_by_us = false;', 'bool mouse_hidden_by_us = false;\nbool throttle_command_rejected = false;', 'native throttle diagnostic latch');
  once('            const bool accepted = control.apply(*command);\n            const auto finished = xmc::NativeMetrics::Clock::now();\n            if (accepted && command->operation == xmc::Operation::Arm',
    `            const bool accepted = control.apply(*command);
            const auto finished = xmc::NativeMetrics::Clock::now();
            if (command->operation == xmc::Operation::Throttle) {
                if (!accepted && !throttle_command_rejected)
                    XPLMDebugString("XPlane Motion Controller: throttle command rejected; check native ARM, throttle DataRef availability and writability.\\n");
                throttle_command_rejected = !accepted;
            }
            if (accepted && command->operation == xmc::Operation::Arm`,
    'native throttle rejection log, once per failure episode');
  once('flight_analysis.reset(); return 1;', 'flight_analysis.reset(); throttle_command_rejected = false; return 1;', 'reset throttle warning latch');
});

// Never write a partial set of files when an anchor differs. All changes were
// staged in memory; make backups first, then atomically rename temp files.
if (process.argv.includes('--check')) {
  console.log(`PRECHECK PASSED (${plans.length} files require update)`);
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backups = [];
try {
  for (const job of plans) {
    const backup = `${job.target}.before-control-audit-${stamp}.bak`;
    fs.copyFileSync(job.target, backup, fs.constants.COPYFILE_EXCL);
    backups.push({ target: job.target, backup });
  }
  for (const job of plans) {
    const temp = `${job.target}.patching-${process.pid}.tmp`;
    fs.writeFileSync(temp, job.final, 'utf8');
    fs.renameSync(temp, job.target);
    console.log(`UPDATED ${job.relative}`);
  }
} catch (error) {
  for (const { target, backup } of backups) fs.copyFileSync(backup, target);
  throw error;
}
console.log(`CONTROL + INSTRUMENT AUDIT PATCH COMPLETE: ${plans.length} source files updated`);
