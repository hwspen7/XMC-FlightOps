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
      socket.send('disarm');
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
    if (!calibrated || !motion.enabled || !socket.connected) {
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
  }, [calibrated, motion.enabled, motion.lastSample, pairingCode, socket.connected, socket.send]);

  const disarm = useCallback(() => {
    transmitting.current = false;
    socket.send('disarm');
    setLocalError(null);
  }, [socket.send]);

  useEffect(() => {
    const disarmWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        transmitting.current = false;
        socket.send('disarm');
      }
    };
    const onPageHide = () => {
      transmitting.current = false;
      socket.send('disarm');
    };
    document.addEventListener('visibilitychange', disarmWhenHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', disarmWhenHidden);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [socket.send]);

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

  return {
    sendAuxiliary, sendThrottle, output, calibrated,
    pairingCode, setPairingCode, localError,
    motion, socket, arm, disarm, recenter, stopSensors,
  };
}
