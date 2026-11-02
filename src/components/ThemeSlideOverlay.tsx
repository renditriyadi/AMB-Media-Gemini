import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ThemeSlideOverlayProps {
  isAnimating: boolean;
  targetIsDark: boolean;
  originX: number;
  originY: number;
  onAnimationEnd: () => void;
}

export const ThemeSlideOverlay: React.FC<ThemeSlideOverlayProps> = ({
  isAnimating,
  targetIsDark,
  originX,
  originY,
  onAnimationEnd,
}) => {
  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          key="theme-slide-overlay"
          initial={{
            clipPath: `circle(0% at ${originX}px ${originY}px)`,
            opacity: 1,
          }}
          animate={{
            clipPath: `circle(170% at ${originX}px ${originY}px)`,
            opacity: 1,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.65,
            ease: [0.16, 1, 0.3, 1],
          }}
          onAnimationComplete={onAnimationEnd}
          className={`fixed inset-0 pointer-events-none z-[999999] ${
            targetIsDark ? 'bg-stone-900 text-amber-400' : 'bg-stone-50 text-stone-900'
          }`}
        />
      )}
    </AnimatePresence>
  );
};
