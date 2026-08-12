/**
 * Reusable Framer Motion animation primitives (Task 17.1; R21.5).
 *
 * These centralize the design's motion language so every screen animates
 * consistently:
 *   - staggered card entrances (translateY 20 -> 0, opacity 0 -> 1, ~0.08s
 *     stagger),
 *   - `whileTap` scale 0.96 micro-interactions with spring feedback.
 *
 * Every helper respects `prefers-reduced-motion`: when the user has requested
 * reduced motion we render the final state immediately with no transform, so
 * the UI is fully usable and never triggers vestibular discomfort (R20 a11y).
 */
import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

/** Stagger timing for card entrances (design.md — ~0.08s stagger). */
const STAGGER_SECONDS = 0.08;

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER_SECONDS },
  },
};

/**
 * Entrance variants for a single card (translateY 20 -> 0, opacity 0 -> 1).
 * Exported so components that must keep native semantics (e.g. a labelled
 * <section>) can render their own `motion.section` while still participating in
 * a parent <StaggerContainer>'s orchestration.
 */
export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

type StaggerContainerProps = {
  children: ReactNode;
  className?: string;
  /** Optional aria/role passthroughs live on the wrapping element. */
} & Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'animate'>;

/**
 * Wraps a column of cards and orchestrates their staggered entrance. Children
 * intended to animate should be <StaggerItem> elements.
 */
export function StaggerContainer({
  children,
  className,
  ...rest
}: StaggerContainerProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial={reduce ? false : 'hidden'}
      animate="visible"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<'div'>, 'variants'>;

/** A single card that rises + fades in as part of a StaggerContainer. */
export function StaggerItem({
  children,
  className,
  ...rest
}: StaggerItemProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? undefined : cardItemVariants}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type TapScaleProps = {
  children: ReactNode;
} & HTMLMotionProps<'button'>;

/**
 * A button with the standard `whileTap` scale 0.96 spring micro-interaction
 * (R21.5). Disabled when reduced motion is requested. Forwards refs and all
 * native button props so it drops in anywhere a <button> is used.
 */
export const TapScale = forwardRef<HTMLButtonElement, TapScaleProps>(
  function TapScale({ children, ...rest }, ref) {
    const reduce = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        whileTap={reduce ? undefined : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);
