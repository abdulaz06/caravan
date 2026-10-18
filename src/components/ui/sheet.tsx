"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "light" | "dusk";
  size?: "auto" | "tall";
  /** Header rendered over content (e.g. a photo gallery) instead of above it. */
  bare?: boolean;
  className?: string;
};

let openSheets = 0;
const noopSubscribe = () => () => {};

/** Bottom sheet: slides up, drag the handle down (or tap outside / Esc) to close. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  tone = "light",
  size = "tall",
  bare,
  className,
}: SheetProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    openSheets++;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => {
      window.removeEventListener("keydown", onKey);
      openSheets--;
      if (openSheets === 0) document.documentElement.style.overflow = "";
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  if (!mounted) return null;
  const dark = tone === "dusk";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-ocean-950/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className={cn(
              "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[30px] shadow-lift outline-none lg:left-auto lg:right-0 lg:w-[480px]",
              size === "tall" ? "h-[94dvh]" : "max-h-[94dvh]",
              dark ? "dusk text-white" : "bg-sand-50 text-ink",
              className,
            )}
          >
            <div
              onPointerDown={(e) => controls.start(e)}
              className={cn(
                "touch-none",
                bare ? "absolute inset-x-0 top-0 z-20" : "relative shrink-0 px-5 pb-3 pt-3",
              )}
            >
              <div
                className={cn(
                  "mx-auto mb-2 h-1.5 w-11 rounded-full",
                  bare ? "bg-white/80 shadow" : dark ? "bg-white/30" : "bg-ink/15",
                )}
              />
              {!bare && (title || eyebrow) && (
                <div className="flex items-start gap-3 pr-10">
                  <div className="min-w-0">
                    {eyebrow && (
                      <div className={cn("label", dark ? "text-saffron-400" : "text-sunset-600")}>{eyebrow}</div>
                    )}
                    {title && (
                      <h2 id={titleId} className="font-display mt-0.5 text-[26px] font-semibold leading-tight">
                        {title}
                      </h2>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className={cn(
                  "absolute right-4 top-4 grid size-9 place-items-center rounded-full transition",
                  bare
                    ? "bg-ink/45 text-white backdrop-blur-md hover:bg-ink/60"
                    : dark
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-ink/5 text-ink hover:bg-ink/10",
                )}
              >
                <X className="size-[18px]" strokeWidth={2.4} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {footer && (
              <div
                className={cn(
                  "pb-safe shrink-0 border-t px-5 pt-3",
                  dark ? "border-white/10 bg-dusk-950/60" : "border-ink/5 bg-sand-50/95",
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
