/**
 * FeatureCard (Task 17.1; R21.3).
 *
 * A dual-tone gradient "feature card" matching the benchmark aesthetic: a
 * gradient surface with asymmetric top-corner radii and white content. Used for
 * quick-action navigation tiles. Rendered as a router <NavLink> so it is
 * keyboard-operable, and carries the `whileTap` scale micro-interaction via
 * Framer Motion (R21.5). Labels/values are text, never color-only (R20.6).
 */
import { motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export type FeatureGradient = 'coral' | 'sky' | 'magenta';

const GRADIENT_CLASS: Record<FeatureGradient, string> = {
  coral: 'bg-feature-coral',
  sky: 'bg-feature-sky',
  magenta: 'bg-feature-magenta',
};

type FeatureCardProps = {
  to: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  gradient: FeatureGradient;
};

export function FeatureCard({
  to,
  title,
  subtitle,
  icon: Icon,
  gradient,
}: FeatureCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div whileTap={reduce ? undefined : { scale: 0.96 }} className="flex-1">
      <NavLink
        to={to}
        className={`flex min-h-[112px] flex-col justify-between rounded-bl-card rounded-br-card rounded-tl-[32px] rounded-tr-[12px] p-4 text-white shadow-card ${GRADIENT_CLASS[gradient]}`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold leading-tight">{title}</p>
          {subtitle ? (
            <p className="text-xs font-medium text-white/80">{subtitle}</p>
          ) : null}
        </div>
      </NavLink>
    </motion.div>
  );
}
