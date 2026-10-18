// Hand-drawn, flat SVG illustrations in the Lanks palette. Decorative only.
import { cn } from "@/lib/cn";

type P = { className?: string };

const FRONDS = [-12, 24, -48, -132, -168, 150];

function PalmShape({ color }: { color: string }) {
  return (
    <>
      <path d="M37 108 C40 86 42 62 39 38 L44 38 C48 62 47 86 44 108 Z" fill={color} />
      {[50, 62, 74, 86, 98].map((y) => (
        <path key={y} d={`M${38 + (108 - y) * 0.02} ${y} q4 -2 7 0`} stroke="rgb(0 0 0 / 0.18)" strokeWidth="1.4" fill="none" />
      ))}
      <g transform="translate(41 37)">
        {FRONDS.map((a) => (
          <path
            key={a}
            transform={`rotate(${a}) scale(1.15)`}
            d="M0 0 C9 -9 25 -10 38 1 C33 -1 30 2 27 0 C24 3 20 1 17 3 C13 1 7 3 0 0 Z"
            fill={color}
          />
        ))}
        <circle cx="-2" cy="4" r="3.2" fill={color} />
        <circle cx="3" cy="5" r="3.2" fill={color} />
      </g>
    </>
  );
}

export function Palm({ className, color = "currentColor" }: P & { color?: string }) {
  return (
    <svg viewBox="-4 -4 88 114" className={className} aria-hidden="true">
      <PalmShape color={color} />
    </svg>
  );
}

export function PalmScene({ className }: P) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6a17f" />
          <stop offset="0.55" stopColor="#f7ba5c" />
          <stop offset="1" stopColor="#fbe0ae" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#ps-sky)" />
      <circle cx="250" cy="170" r="62" fill="#fdf0d6" opacity="0.9" />
      <rect y="190" width="400" height="110" fill="#117485" />
      {[204, 222, 242, 264].map((y, i) => (
        <path
          key={y}
          d={`M0 ${y} q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0`}
          stroke="#79c6c3"
          strokeWidth={3 - i * 0.5}
          fill="none"
          opacity={0.8 - i * 0.15}
        />
      ))}
      <g transform="translate(20 52) scale(2.2)">
        <PalmShape color="#173d2c" />
      </g>
    </svg>
  );
}

export function SunMark({ className }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="7" fill="currentColor" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x="15"
          y="1.5"
          width="2"
          height="5"
          rx="1"
          fill="currentColor"
          transform={`rotate(${i * 30} 16 16)`}
        />
      ))}
    </svg>
  );
}

export function TukTuk({ className }: P) {
  return (
    <svg viewBox="0 0 72 50" className={className} aria-hidden="true">
      {/* canopy roof */}
      <path d="M9 15 Q10 5 22 4 H42 Q51 4 55 10 L57 14 H51 Q48 9 42 9 H22 Q14 10 13 15 Z" fill="#1a8e9c" />
      {/* body */}
      <path d="M9 15 H13 V33 H40 V15 H52 L61 31 Q63 34 62 37 H9 Z" fill="#ec6437" />
      {/* open side with bench */}
      <path d="M13 15 H40 V33 H13 Z" fill="#1d1914" opacity="0.88" />
      <rect x="15" y="25" width="15" height="4" rx="1.5" fill="#f7ba5c" />
      {/* windscreen */}
      <path d="M43 15 H51 L57 26 H43 Z" fill="#d6efeb" />
      <rect x="9" y="33" width="54" height="2.5" fill="#f7ba5c" />
      {/* wheels: big rear, small front */}
      <circle cx="19" cy="40" r="6.5" fill="#1d1914" />
      <circle cx="19" cy="40" r="2.4" fill="#efe1c9" />
      <circle cx="56" cy="41" r="5" fill="#1d1914" />
      <circle cx="56" cy="41" r="1.9" fill="#efe1c9" />
      <circle cx="61" cy="30" r="1.8" fill="#fbe0ae" />
    </svg>
  );
}

export function Van({ className }: P) {
  return (
    <svg viewBox="0 0 72 44" className={className} aria-hidden="true">
      <path d="M4 33 V12 Q4 6 10 6 H44 Q50 6 54 11 L64 22 Q67 25 67 29 V33 Z" fill="currentColor" />
      <path d="M46 10 Q50 10 52 13 L59 21 H46 Z" fill="#d6efeb" />
      <rect x="9" y="11" width="10" height="9" rx="2" fill="#d6efeb" />
      <rect x="22" y="11" width="10" height="9" rx="2" fill="#d6efeb" />
      <rect x="35" y="11" width="8" height="9" rx="2" fill="#d6efeb" />
      <rect x="4" y="25" width="63" height="3" fill="#f2a33a" />
      <circle cx="17" cy="34" r="6" fill="#1d1914" />
      <circle cx="17" cy="34" r="2.2" fill="#efe1c9" />
      <circle cx="54" cy="34" r="6" fill="#1d1914" />
      <circle cx="54" cy="34" r="2.2" fill="#efe1c9" />
    </svg>
  );
}

export function Train({ className }: P) {
  return (
    <svg viewBox="0 0 96 40" className={className} aria-hidden="true">
      <path d="M2 30 V10 Q2 5 7 5 H80 Q92 5 94 18 V30 Z" fill="#1a6fb0" />
      <rect x="2" y="21" width="92" height="4" fill="#c9302c" />
      {[8, 22, 36, 50, 64].map((x) => (
        <rect key={x} x={x} y="9" width="10" height="8" rx="1.5" fill="#d6efeb" />
      ))}
      <path d="M80 9 H86 Q90 9 91 15 V17 H80 Z" fill="#d6efeb" />
      {[14, 30, 62, 78].map((x) => (
        <circle key={x} cx={x} cy="32" r="4" fill="#1d1914" />
      ))}
      <rect x="0" y="36" width="96" height="2" fill="#8a7e70" />
    </svg>
  );
}

export function Elephant({ className }: P) {
  return (
    <svg viewBox="0 0 72 52" className={className} aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="30" cy="25" rx="20" ry="14" />
        <rect x="13" y="30" width="7" height="17" rx="3" />
        <rect x="23" y="32" width="7" height="15" rx="3" />
        <rect x="34" y="32" width="7" height="15" rx="3" />
        <rect x="42" y="30" width="7" height="17" rx="3" />
        <circle cx="51" cy="20" r="11" />
        <path d="M58 24 C64 30 64 39 60 46 Q59 48 57 47 L55 46 C58 40 58 33 53 28 Z" />
        <path d="M11 22 Q6 26 7 34" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx="46" cy="21" rx="7" ry="9" fill="rgb(0 0 0 / 0.18)" />
      <circle cx="55" cy="17" r="1.6" fill="#fffbf4" />
      <path d="M59 27 Q62 28 64 26" stroke="#fffbf4" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Waves({ className }: P) {
  return (
    <svg viewBox="0 0 240 24" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path
        d="M0 12 q15 -10 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wavy edge for the bottom of a coloured section. */
export function WaveEdge({ className, fill = "currentColor" }: P & { fill?: string }) {
  return (
    <svg viewBox="0 0 400 24" preserveAspectRatio="none" className={cn("block w-full", className)} aria-hidden="true">
      <path d="M0 24 V10 Q25 0 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 T350 10 T400 10 V24 Z" fill={fill} />
    </svg>
  );
}

export function Sparkle({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill="currentColor" />
    </svg>
  );
}

export function Firework({ className }: P) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 36} 20 20)`}>
          <rect x="19" y="3" width="2" height="8" rx="1" fill="currentColor" />
          <circle cx="20" cy="2" r="1.4" fill="currentColor" />
        </g>
      ))}
      <circle cx="20" cy="20" r="2.4" fill="currentColor" />
    </svg>
  );
}
