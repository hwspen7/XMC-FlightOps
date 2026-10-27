import { useCallback, useEffect, useRef, useState } from 'react';
import { fromDeviceOrientation, type Quaternion } from '../motion/quaternion';

export interface MotionSample {
  quaternion: Quaternion;
  timestamp: number;
}

interface PermissionDeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export function useDeviceOrientation(onSample: (sample: MotionSample) => void) {
  const callback = useRef(onSample);
  const lastSample = useRef<MotionSample | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReadingAt, setLastReadingAt] = useState(0);
  const [sampleRateHz, setSampleRateHz] = useState(0);
  callback.current = onSample;

  const requestAccess = useCallback(async () => {
    if (!window.isSecureContext) {
      setError('Motion sensors require HTTPS or a secure localhost origin.');
      return;
    }
    if (!('DeviceOrientationEvent' in window)) {
      setError('This browser does not support device orientation.');
      return;
    }
    try {
      const constructor = DeviceOrientationEvent as unknown as PermissionDeviceOrientationEvent;
      if (typeof constructor.requestPermission === 'function') {
        const permission = await constructor.requestPermission();
        if (permission !== 'granted') {
          setError('Motion access was denied. Enable motion access in Safari settings.');
          return;
        }
      }
      setError(null);
      setEnabled(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start motion sensors.');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let lastUiUpdate = 0;
    let sampleWindowAt = performance.now();
    let sampleCount = 0;
    function handle(event: DeviceOrientationEvent) {
      if (event.alpha === null || event.beta === null || event.gamma === null) return;
      const sample = {
        quaternion: fromDeviceOrientation(event.alpha, event.beta, event.gamma),
        timestamp: performance.now(),
      };
      sampleCount++;
      const windowMs = sample.timestamp - sampleWindowAt;
      if (windowMs >= 1000) {
        setSampleRateHz(Math.round(sampleCount * 1000 / windowMs));
        sampleCount = 0;
        sampleWindowAt = sample.timestamp;
      }
      lastSample.current = sample;
      callback.current(sample);
      if (sample.timestamp - lastUiUpdate > 100) {
        lastUiUpdate = sample.timestamp;
        setLastReadingAt(Date.now());
        setAvailable(true);
      }
    }
    window.addEventListener('deviceorientation', handle);
    return () => window.removeEventListener('deviceorientation', handle);
  }, [enabled]);

  const stop = useCallback(() => {
    setEnabled(false);
    setAvailable(false);
    setSampleRateHz(0);
    lastSample.current = null;
  }, []);

  return { enabled, available, error, lastReadingAt, sampleRateHz, lastSample, requestAccess, stop };
}
