/**
 * Reusable circular progress arc (Task 17.1; R21.5).
 *
 * A clockwise SVG stroke-fill that animates on mount over ~1.2s easeOut
 * (design.md — circular progress arc). The arc is decorative; callers provide
 * the accessible value in adjacent text and children are rendered centered.
 * Honors `prefers-reduced-motion` by rendering the filled arc immediately.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type CircularProgressProps = {
  /** Fraction of the ring to fill, 0..1 (clamped). Defaults to 1 (full). */
  progress?: number;
  size?: number;
  stroke?: number;
  /** Stroke color of the filled arc. */
  color?: string;
  /** Stroke color of the track behind the arc. */
  trackColor?: string;
  children?: ReactNode;
  className?: string;
};

export function CircularProgress({
  progress = 1,
  size = 176,
  stroke = 14,
  color = '#4F5BE0',
  trackColor = '#E2E8F0',
  children,
  className,
}: CircularProgressProps) {
  const reduce = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - clamped);

  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ''}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? targetOffset : circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut' }}
        />
      </svg>
      {children ? (
        <div className="absolute flex flex-col items-center">{children}</div>
      ) : null}
    </div>
  );
}
