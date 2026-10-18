"use client";

import { MotionConfig } from "framer-motion";
import { ToastProvider } from "./ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32 }}>
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
