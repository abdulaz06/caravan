"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ocean" | "light" | "ghost" | "outline" | "glass";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-sunset-500 text-white shadow-[0_4px_0_0_var(--color-sunset-700)] hover:bg-sunset-600 active:shadow-[0_1px_0_0_var(--color-sunset-700)] active:translate-y-[3px]",
  ocean:
    "bg-ocean-800 text-white shadow-[0_4px_0_0_var(--color-ocean-950)] hover:bg-ocean-700 active:shadow-[0_1px_0_0_var(--color-ocean-950)] active:translate-y-[3px]",
  light:
    "bg-paper text-ink shadow-[0_4px_0_0_var(--color-sand-300)] hover:bg-white active:shadow-[0_1px_0_0_var(--color-sand-300)] active:translate-y-[3px]",
  ghost: "text-ink-2 hover:bg-sand-200/70",
  outline: "border-2 border-ink/85 text-ink hover:bg-ink hover:text-paper",
  glass: "bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md hover:bg-white/25",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-12 px-6 text-[15px] gap-2",
  lg: "h-14 px-7 text-base gap-2.5",
};

const base =
  "relative inline-flex select-none items-center justify-center rounded-full font-semibold tracking-[-0.01em] transition-[background-color,box-shadow,transform,color] duration-150 disabled:pointer-events-none disabled:opacity-45";

export function buttonClass(variant: Variant = "primary", size: Size = "md", block?: boolean, className?: string) {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

/** A link that looks exactly like a Button. */
export function ButtonLink({
  href,
  variant,
  size,
  block,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <Link href={href} className={buttonClass(variant, size, block, className)} {...rest}>
      {children}
    </Link>
  );
}

export type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, type = "button", ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.98 }}
      className={buttonClass(variant, size, block, className)}
      {...props}
    />
  );
});
