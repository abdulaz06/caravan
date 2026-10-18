"use client";

import { motion } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
  id?: string;
};

/** Four big PIN boxes backed by one numeric input (works with mobile keypads & paste). */
export const PinInput = forwardRef<HTMLInputElement, Props>(function PinInput(
  { value, onChange, onComplete, error, disabled, autoFocus, label, id },
  ref,
) {
  return (
    <div className={cn("relative", error && "animate-shake")}>
      <input
        ref={ref}
        id={id}
        aria-label={label}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={4}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange(v);
          if (v.length === 4) onComplete?.(v);
        }}
        className="peer absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-4 gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < value.length;
          const active = i === Math.min(value.length, 3);
          return (
            <div
              key={i}
              className={cn(
                "grid h-16 place-items-center rounded-2xl border-2 bg-paper transition-colors",
                error
                  ? "border-sunset-500"
                  : active
                    ? "border-ink/70 peer-focus:border-ocean-600"
                    : "border-sand-300",
              )}
            >
              {filled && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 22 }}
                  className="size-3.5 rounded-full bg-ink"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
