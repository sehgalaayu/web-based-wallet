import React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export function GlowCard({ children, className, glowColor = "violet" }) {
  const cardRef = React.useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(springY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-5, 5]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const glowColors = {
    violet: "from-violet-500/20 via-purple-500/10 to-fuchsia-500/20",
    emerald: "from-emerald-500/20 via-green-500/10 to-teal-500/20",
    blue: "from-blue-500/20 via-cyan-500/10 to-sky-500/20",
    amber: "from-amber-500/20 via-orange-500/10 to-yellow-500/20",
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={cn(
        "relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 backdrop-blur-xl",
        "shadow-[0_0_50px_rgba(139,92,246,0.15)] hover:shadow-[0_0_80px_rgba(139,92,246,0.25)]",
        "transition-shadow duration-500",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          glowColors[glowColor] || glowColors.violet,
        )}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
