import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 300 : -300, opacity: 0 }),
};

function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <motion.div
      key={location}
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedPageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location}>{children}</PageTransition>
    </AnimatePresence>
  );
}
