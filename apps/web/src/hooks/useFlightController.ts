import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuxiliaryAction } from '@xplane/shared';
import { DEFAULT_YOKE_SETTINGS, YokeController, ZERO_OUTPUT, type YokeOutput, type YokeSettings } from '../controllers/yoke';
import { useDeviceOrientation, type MotionSample } from './useDeviceOrientation';
import { useControlSocket } from '../network/useControlSocket';

export function useFlightController() {
  const processor = useRef(new YokeController());
  const latestControl = useRef<YokeOutput>(ZERO_OUTPUT);
  const lastViewAt = useRef(0);
  const sequence = useRef(0);
  const [output, setOutput] = useState<YokeOutput>(ZERO_OUTPUT);
  const [calibrated, setCalibrated] = useState(false);
  const [settings, setSettings] = useState<YokeSettings>(DEFAULT_YOKE_SETTINGS);
  const [pairingCode, setPairingCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const socket = useControlSocket();

  const onSample = useCallback((sample: MotionSample) => {
    const next = processor.current.update(sample.quaternion, sample.timestamp);
    latestControl.current = next;
    if (sample.timestamp - lastViewAt.current > 35) {
      lastViewAt.current = sample.timestamp;
      setOutput(next);
    }
  }, []);
  const motion = useDeviceOrientation(onSample);

  useEffect(() => processor.current.configure(settings), [settings]);

  const recenter = useCallback(() => {
    const sample = motion.lastSample.current;
    if (!sample || performance.now() - sample.timestamp > 500) {
      setLocalError('No recent motion sample. Enable sensors and move the device.');
      return;
    }
    processor.current.calibrate(sample.quaternion);
    latestControl.current = ZERO_OUTPUT;
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
    socket.send('arm', { pairingCode: pairingCode.trim() });
  }, [calibrated, motion.enabled, motion.lastSample, pairingCode, socket.connected, socket.send]);

  const disarm = useCallback(() => {
    socket.send('disarm');
    setLocalError(null);
  }, [socket.send]);

  const stopSensors = useCallback(() => {
    disarm();
    motion.stop();
    processor.current.reset();
    latestControl.current = ZERO_OUTPUT;
    setOutput(ZERO_OUTPUT);
    setCalibrated(false);
  }, [disarm, motion.stop]);

  useEffect(() => {
    if (!socket.connected || !socket.serverStatus.ownedByYou || !motion.enabled) return;
    const clock = window.setInterval(() => {
      const sample = motion.lastSample.current;
      if (!sample || performance.now() - sample.timestamp > 250) return;
      socket.send('control', {
        sequence: sequence.current++,
        roll: latestControl.current.roll,
        pitch: latestControl.current.pitch,
        sensorRateHz: motion.sampleRateHz,
        tiltRollDegrees: latestControl.current.rawRollDegrees,
        tiltPitchDegrees: latestControl.current.rawPitchDegrees,
      });
    }, 33);
    return () => clearInterval(clock);
  }, [motion.enabled, motion.lastSample, motion.sampleRateHz, socket.connected, socket.send, socket.serverStatus.ownedByYou]);

  const sendAuxiliary = useCallback((action: AuxiliaryAction) => {
    if (socket.serverStatus.ownedByYou && socket.serverStatus.simulator.outputEnabled) socket.send('auxiliary', action);
  }, [socket.send, socket.serverStatus.ownedByYou, socket.serverStatus.simulator.outputEnabled]);

  const sendThrottle = useCallback((ratio: number) => {
    if (socket.serverStatus.ownedByYou && socket.serverStatus.simulator.outputEnabled) socket.send('throttle', ratio);
  }, [socket.send, socket.serverStatus.ownedByYou, socket.serverStatus.simulator.outputEnabled]);

  return {
    sendAuxiliary, sendThrottle, output, calibrated, settings, setSettings,
    pairingCode, setPairingCode, localError,
    motion, socket, arm, disarm, recenter, stopSensors,
  };
}
