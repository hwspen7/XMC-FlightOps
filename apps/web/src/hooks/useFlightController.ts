import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuxiliaryAction } from '@xplane/shared';
import { YokeController, ZERO_OUTPUT, type YokeOutput } from '../controllers/yoke';
import { useDeviceOrientation, type MotionSample } from './useDeviceOrientation';
import { useControlSocket } from '../network/useControlSocket';

export function useFlightController() {
  const processor = useRef(new YokeController());
  const lastViewAt = useRef(0);
  const lastTransmitAt = useRef(0);
  const sequence = useRef(0);
  const transmitting = useRef(false);
  const sensorRate = useRef(0);
  const [output, setOutput] = useState<YokeOutput>(ZERO_OUTPUT);
  const [calibrated, setCalibrated] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const socket = useControlSocket();

  // Keep sensor-to-network forwarding out of React's rendering and 33 ms timers.
  // One event generates at most one new command. WebSocket never queues stale
  // control frames under network congestion.
  const onSample = useCallback((sample: MotionSample) => {
    if (processor.current.isCalibrated() && !processor.current.matchesOrientation(sample.screenAngle)) {
      // A flipped screen changes the physical pitch axis. Release authority.
      transmitting.current = false;
      socket.send('suspend');
      processor.current.reset();
      setCalibrated(false);
      setOutput(ZERO_OUTPUT);
      setLocalError('Phone orientation changed. Recenter before arming again.');
      return;
    }
    const next = processor.current.update(sample.quaternion, sample.screenAngle);
    if (sample.timestamp - lastViewAt.current >= 35) {
      lastViewAt.current = sample.timestamp;
      setOutput(next);
    }
    if (!transmitting.current || !processor.current.isCalibrated()) return;
    if (sample.timestamp - lastTransmitAt.current < 12) return; // 60 Hz typical, 83 Hz maximum
    if (socket.send('control', {
      sequence: sequence.current,
      roll: next.roll,
      pitch: next.pitch,
      sensorRateHz: sensorRate.current,
      tiltRollDegrees: next.rawRollDegrees,
      tiltPitchDegrees: next.rawPitchDegrees,
    })) {
      lastTransmitAt.current = sample.timestamp;
      sequence.current++;
    }
  }, [socket.send]);

  const motion = useDeviceOrientation(onSample);
  sensorRate.current = motion.sampleRateHz;
  transmitting.current = socket.connected && socket.serverStatus.ownedByYou && motion.enabled && calibrated;

  const recenter = useCallback(() => {
    const sample = motion.lastSample.current;
    if (!sample || performance.now() - sample.timestamp > 500) {
      setLocalError('No recent motion sample. Enable sensors and move the device.');
      return;
    }
    processor.current.calibrate(sample.quaternion, sample.screenAngle);
    lastTransmitAt.current = 0;
    setOutput(ZERO_OUTPUT);
    setCalibrated(true);
    setLocalError(null);
  }, [motion.lastSample]);

  const arm = useCallback(() => {
    if (!calibrated || !motion.enabled || !socket.connected ||
        (!socket.sessionRestored && !/^\d{6}$/.test(pairingCode.trim()))) {
      setLocalError('Connect the server, enable sensors, and recenter before arming.');
      return;
    }
    if (performance.now() - (motion.lastSample.current?.timestamp ?? 0) > 500) {
      setLocalError('Live motion updates are required to arm the controller.');
      return;
    }
    setLocalError(null);
    sequence.current = 0;
    lastTransmitAt.current = 0;
    socket.send('arm', { pairingCode: pairingCode.trim() });
  }, [calibrated, motion.enabled, motion.lastSample, pairingCode, socket.connected, socket.sessionRestored, socket.send]);

  const disarm = useCallback(() => {
    transmitting.current = false;
    socket.send('disarm');
    setLocalError(null);
  }, [socket.send]);

  useEffect(() => {
    let interrupted = false;
    const suspendForInterruption = () => {
      if (interrupted) return;
      interrupted = true;
      transmitting.current = false;
      // This message is best effort. The server and native plugin independently
      // suspend flight when incoming control samples stop.
      socket.send('suspend');
      processor.current.reset();
      setCalibrated(false);
      setOutput(ZERO_OUTPUT);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') suspendForInterruption();
      else interrupted = false;
    };
    const onPageShow = () => { interrupted = false; };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', suspendForInterruption);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', suspendForInterruption);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [socket.send]);

  useEffect(() => {
    if (!localError) return;
    const timer = setTimeout(() => setLocalError(null), 4500);
    return () => clearTimeout(timer);
  }, [localError]);

  const resumeFlight = useCallback(() => {
    const simulator = socket.serverStatus.simulator;
    if (!socket.connected || !socket.serverStatus.ownedByYou ||
        !calibrated || !motion.enabled ||
        simulator.nativeArmed !== true || simulator.pauseOwned !== true ||
        simulator.nativeInterrupted !== true || simulator.simPaused !== true ||
        performance.now() - (motion.lastSample.current?.timestamp ?? 0) > 500) {
      setLocalError('Recenter, restore native control, then resume the flight.');
      return;
    }
    if (!socket.send('resume')) setLocalError('The server is disconnected. Flight remains paused.');
  }, [calibrated, motion.enabled, motion.lastSample, socket.connected,
      socket.serverStatus.ownedByYou, socket.serverStatus.simulator, socket.send]);

  const stopSensors = useCallback(() => {
    disarm();
    motion.stop();
    processor.current.reset();
    setOutput(ZERO_OUTPUT);
    setCalibrated(false);
  }, [disarm, motion.stop]);

  const sendAuxiliary = useCallback((action: AuxiliaryAction) => {
    if (socket.serverStatus.ownedByYou && socket.serverStatus.simulator.outputEnabled) socket.send('auxiliary', action);
  }, [socket.send, socket.serverStatus.ownedByYou, socket.serverStatus.simulator.outputEnabled]);

  const sendThrottle = useCallback((ratio: number) => {
    if (socket.serverStatus.ownedByYou && socket.serverStatus.simulator.outputEnabled) socket.send('throttle', ratio);
  }, [socket.send, socket.serverStatus.ownedByYou, socket.serverStatus.simulator.outputEnabled]);

  const sendPedal = useCallback((action: 'rudder' | 'brakes' | 'reverse', value: number) => {
    if (socket.connected && socket.serverStatus.ownedByYou && socket.serverStatus.simulator.nativeArmed === true) {
      socket.send('pedal', { action, value });
    }
  }, [socket.connected, socket.send, socket.serverStatus.ownedByYou, socket.serverStatus.simulator.nativeArmed]);
  const startRecording = useCallback(() => socket.send('recording-start'), [socket.send]);
  const stopRecording = useCallback(() => socket.send('recording-stop'), [socket.send]);
  const exportRecording = useCallback(() => socket.send('recording-export'), [socket.send]);

  return {
    sendPedal, startRecording, stopRecording, exportRecording,
    sendAuxiliary, sendThrottle, output, calibrated,
    pairingCode, setPairingCode, localError,
    motion, socket, arm, disarm, recenter, resumeFlight, stopSensors,
  };
}
