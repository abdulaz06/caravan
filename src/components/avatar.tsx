import { cn } from "@/lib/cn";

const TONES = [
  "bg-highlight-500 text-ink",
  "bg-accent-500 text-white",
  "bg-primary-500 text-white",
  "bg-secondary-600 text-white",
  "bg-pop-500 text-white",
  "bg-surface-300 text-ink",
];

export function toneFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <span
      className={cn(
        "font-display grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-bold ring-2 ring-paper",
        toneFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export function AvatarStack({ initials, className }: { initials: string[]; className?: string }) {
  return (
    <div className={cn("flex -space-x-2.5", className)}>
      {initials.map((i, k) => (
        <span
          key={k}
          className={cn(
            "font-display grid size-8 place-items-center rounded-full text-sm font-bold ring-2 ring-primary-950",
            TONES[k % TONES.length],
          )}
        >
          {i}
        </span>
      ))}
    </div>
  );
}
