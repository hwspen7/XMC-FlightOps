import { useId } from 'react';
import type { YokeOutput } from '../../controllers/yoke';

interface Props { output: YokeOutput; calibrated: boolean; }

export function MotionAttitude({ output, calibrated }: Props) {
  const prefix = useId().replace(/:/g, '');
  const roll = calibrated ? output.rawRollDegrees : 0;
  const pitch = calibrated ? output.rawPitchDegrees : 0;
  const boundedPitch = Math.min(50, Math.max(-50, pitch));
  return (
    <div className="motion-attitude">
      <svg viewBox="0 0 360 340" role="img" aria-label="Phone yoke command reference display">
        <defs>
          <clipPath id={`${prefix}-circle`}><circle cx="180" cy="172" r="144" /></clipPath>
          <linearGradient id={`${prefix}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#127ac4"/><stop offset="1" stopColor="#4fa7e2"/></linearGradient>
          <linearGradient id={`${prefix}-earth`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a46c40"/><stop offset="1" stopColor="#593b2a"/></linearGradient>
        </defs>
        <circle cx="180" cy="172" r="151" fill="#0e1c29" stroke="#2b475e" strokeWidth="2"/>
        <g clipPath={`url(#${prefix}-circle)`}>
          <g transform={`translate(180 172) rotate(${Math.max(-90, Math.min(90, roll))}) translate(0 ${boundedPitch * 3.4})`}>
            <rect x="-500" y="-700" width="1000" height="700" fill={`url(#${prefix}-sky)`}/>
            <rect x="-500" y="0" width="1000" height="700" fill={`url(#${prefix}-earth)`}/>
            <path d="M-500 0 H500" stroke="#f7fbff" strokeWidth="2.6"/>
            {[-40,-30,-20,-10,10,20,30,40].map((degree) => <g key={degree} transform={`translate(0 ${-degree * 3.4})`} stroke="#f6f9fc" fill="#f6f9fc"><path d={`M${degree % 20 === 0 ? -50 : -28} 0 H-9 M9 0 H${degree % 20 === 0 ? 50 : 28}`} strokeWidth="1.7"/><text x="-64" y="4" fontSize="10" textAnchor="middle" stroke="none">{Math.abs(degree)}</text><text x="64" y="4" fontSize="10" textAnchor="middle" stroke="none">{Math.abs(degree)}</text></g>)}
          </g>
          <circle cx="180" cy="172" r="144" fill="none" stroke="#94c4e9" strokeWidth="3" opacity=".55" />
          <path d="M106 172 H156 L165 184 H195 L204 172 H254" fill="none" stroke="#ffd345" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="180" cy="172" r="5" fill="#ffd345" />
          <path d="M180 30 V44 M111 50 L119 64 M249 50 L241 64 M47 172 H62 M298 172 H313" stroke="#dce9f3" strokeWidth="3" fill="none"/>
        </g>
        <g transform="translate(180 10)"><path d="M0 0 L-12 22 H12Z" fill="#ffc943"/></g>
        <g className="horizon-data" fill="#fff">
          <text x="180" y="334" textAnchor="middle" fontSize="12" letterSpacing="3">{calibrated ? 'MOTION REFERENCE' : 'CALIBRATION REQUIRED'}</text>
        </g>
      </svg>
      <span className="motion-caption">TILT THE DEVICE TO CONTROL THE AIRCRAFT</span>
    </div>
  );
}
