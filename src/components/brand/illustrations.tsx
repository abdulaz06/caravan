// Hand-drawn, flat SVG illustrations. Decorative only. Presets choose a set
// (tropical or alpine) through brand/art.tsx.
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
      {/* sleepers + rail */}
      {[4, 14, 24, 34, 44, 54, 64, 74, 84].map((x) => (
        <rect key={x} x={x} y="35" width="6" height="3" rx="0.5" fill="#b9ab97" />
      ))}
      <rect x="0" y="34" width="96" height="1.6" fill="#6b6155" />
      {/* carriage */}
      <rect x="2" y="9" width="40" height="22" rx="3" fill="#1a6fb0" />
      <rect x="2" y="23" width="40" height="3" fill="#c9302c" />
      {[6, 18, 30].map((x) => (
        <rect key={x} x={x} y="12" width="8" height="7" rx="1.5" fill="#d6efeb" />
      ))}
      <rect x="42" y="25" width="5" height="2" fill="#1d1914" />
      {/* locomotive with a sloped nose */}
      <path d="M47 31 V11 Q47 7 51 7 H76 Q84 7 88 14 L94 25 V31 Z" fill="#1a6fb0" />
      <rect x="62" y="3" width="5" height="5" rx="1" fill="#1d1914" />
      <rect x="47" y="23" width="47" height="3" fill="#c9302c" />
      <rect x="51" y="11" width="8" height="7" rx="1.5" fill="#d6efeb" />
      <path d="M78 11 H82 Q85 11 87 15 L89 19 H78 Z" fill="#d6efeb" />
      <circle cx="92" cy="28.5" r="1.6" fill="#f4b545" />
      {[10, 34, 55, 83].map((x) => (
        <circle key={x} cx={x} cy="31.5" r="3" fill="#1d1914" />
      ))}
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

/**
 * "Stay in" mark: a little tropical villa with a palm and a pool.
 * Day: sun overhead. Night: crescent moon and a glowing window.
 */
export function StayInIcon({ variant = "night", className }: P & { variant?: "day" | "night" }) {
  const night = variant === "night";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {night ? (
        <g fill="#fbe0ae">
          <path d="M37.5 4.5a6.5 6.5 0 1 0 6.2 9.6 5.2 5.2 0 0 1-6.2-9.6z" />
          <circle cx="29.5" cy="7" r="1.1" />
          <circle cx="44.5" cy="20.5" r="0.9" />
        </g>
      ) : (
        <g fill="#f2a33a">
          <circle cx="37" cy="10" r="4.4" />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x="36.3" y="1.4" width="1.4" height="3" rx="0.7" transform={`rotate(${i * 45} 37 10)`} />
          ))}
        </g>
      )}
      {/* palm */}
      <path d="M38.6 43 C39.8 36 40 30 38.6 23.5 L40.6 23.4 C42.2 30 41.8 36 40.8 43 Z" fill="#1e5139" />
      <g transform="translate(39.6 23)" fill="#2b6a48">
        {[-150, -110, -60, -20, 25].map((a) => (
          <path key={a} transform={`rotate(${a})`} d="M0 0 C3 -3.4 8 -3.6 11.5 0.2 C8.5 -0.8 4 -0.2 0 0 Z" />
        ))}
      </g>
      {night && <circle cx="17" cy="31" r="8.5" fill="#f7ba5c" opacity="0.32" />}
      {/* villa */}
      <rect x="8.5" y="24" width="25" height="17.5" rx="1.2" fill="#f3e3c7" />
      <rect x="8.5" y="38.5" width="25" height="3" fill="#e2cba6" />
      <path d="M5 26 L21 13.2 L37 26 Z" fill="#c4461f" />
      <path d="M5 26 H37" stroke="#8a2f15" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 13.2 L29 19.6" stroke="#e86a3e" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      {/* window */}
      <rect x="12.5" y="28.5" width="8.5" height="7" rx="1" fill={night ? "#f7ba5c" : "#79c6c3"} />
      <path d="M16.75 28.5 V35.5 M12.5 32 H21" stroke="#f3e3c7" strokeWidth="1.1" />
      {/* door */}
      <path d="M24.5 41.5 V33.6 a3.25 3.25 0 0 1 6.5 0 V41.5 Z" fill="#0d5a69" />
      <circle cx="29.6" cy="37.6" r="0.6" fill="#f7ba5c" />
      {/* pool */}
      <rect x="3" y="41.5" width="42" height="4" rx="2" fill="#1a8e9c" />
      <path d="M7 43.5 q2 -1 4 0 t4 0 M27 43.5 q2 -1 4 0 t4 0" stroke="#d6efeb" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Ella day-trip mark: Little Adam's Peak's rounded tea-covered hills with the
 * sun coming up through Ella Gap (`rising`) or riding high for the easy morning.
 */
export function HillSunIcon({ className, rising = false }: P & { rising?: boolean }) {
  const sun = rising ? { cx: 24, cy: 27, r: 7 } : { cx: 34, cy: 14, r: 5.5 };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {rising && <circle cx="24" cy="27" r="14" fill="#f7ba5c" opacity=".28" />}
      <g>
        <circle {...sun} fill="#f2a33a" />
        {Array.from({ length: 7 }, (_, i) => (
          <rect
            key={i}
            x={sun.cx - 0.8}
            y={sun.cy - sun.r - 5}
            width="1.6"
            height="3.2"
            rx=".8"
            fill="#f2a33a"
            transform={`rotate(${-90 + i * 30} ${sun.cx} ${sun.cy})`}
          />
        ))}
      </g>
      {/* Ella Rock and Little Adam's Peak either side of the gap */}
      <path d="M0 40 C4 24 12 19 19 28 C21 31 22 33 24 34 L0 44 Z" fill="#1e5139" />
      <path d="M48 40 C45 27 38 22 31 29 C28 32 26 33 24 34 L48 44 Z" fill="#2b6a48" />
      {/* tea-estate hill in front, with its rows */}
      <path d="M0 48 V38 C9 30 19 31 27 36 C34 33 42 33 48 37 V48 Z" fill="#6aa06a" />
      <path
        d="M3 41 C10 36 17 36 24 39 M5 45 C13 40 21 40 28 43 M29 40 C35 37 41 37 46 39 M32 45 C37 42 42 42 47 43"
        fill="none"
        stroke="#2b6a48"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}

/** A small rental car (self-drive trips). */
export function Car({ className }: P) {
  return (
    <svg viewBox="0 0 72 44" className={className} aria-hidden="true">
      <path d="M6 32 V25 Q6 21 10 20 L18 18 L26 9 Q28 7 31 7 H46 Q50 7 52 10 L59 18 L64 19 Q68 20 68 24 V32 Z" fill="currentColor" />
      <path d="M28 11 H37 V18 H22 Z M40 11 H46 Q48 11 49 13 L53 18 H40 Z" fill="#e6eef6" />
      <rect x="6" y="25" width="62" height="2.5" fill="var(--color-highlight-500)" />
      <circle cx="19" cy="33" r="6" fill="#1d1914" />
      <circle cx="19" cy="33" r="2.2" fill="#e9e2d5" />
      <circle cx="55" cy="33" r="6" fill="#1d1914" />
      <circle cx="55" cy="33" r="2.2" fill="#e9e2d5" />
      <rect x="40" y="2.5" width="20" height="3.2" rx="1.2" fill="#e6eef6" />
      <path d="M43 5.7 V8 M57 5.7 V8" stroke="#1d1914" strokeWidth="1.4" />
    </svg>
  );
}

/** Photo fallback for the alpine set: snowy peaks over a pine valley at dusk. */
export function MountainScene({ className }: P) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24345c" />
          <stop offset="0.6" stopColor="#5d78a8" />
          <stop offset="1" stopColor="#c9d8ec" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#ms-sky)" />
      <circle cx="300" cy="80" r="26" fill="#f1e6c8" opacity="0.9" />
      <path d="M-10 230 L90 90 L150 160 L215 60 L320 200 L360 150 L420 230 V300 H-10 Z" fill="#e9f0f8" />
      <path d="M90 90 L118 130 L104 124 L92 138 L80 122 L66 128 Z M215 60 L246 104 L230 98 L216 114 L202 98 L186 104 Z" fill="#ffffff" />
      <path d="M-10 250 L60 180 L120 230 L190 170 L260 230 L330 185 L420 250 V300 H-10 Z" fill="#2f4a6e" />
      {[30, 70, 110, 300, 340, 380].map((x, i) => (
        <path key={x} d={`M${x} ${262 - (i % 2) * 8} l12 -34 l12 34 Z`} fill="#16324a" />
      ))}
      <rect y="268" width="400" height="32" fill="#f4f7fb" />
    </svg>
  );
}

/**
 * "Stay in" for the alpine set: a stone-and-timber house with a snowy roof.
 * Day: sun overhead. Night: crescent moon and a warm fire-lit window.
 */
export function ChaletIcon({ variant = "night", className }: P & { variant?: "day" | "night" }) {
  const night = variant === "night";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {night ? (
        <path d="M37.5 4.5a6.5 6.5 0 1 0 6.2 9.6 5.2 5.2 0 0 1-6.2-9.6z" fill="#f1e6c8" />
      ) : (
        <circle cx="37" cy="10" r="4.6" fill="#f2c14e" />
      )}
      <path d="M2 46 L12 30 L18 38 L26 26 L46 46 Z" fill={night ? "#3d5a85" : "#b9cbe2"} />
      {night && <circle cx="18" cy="34" r="9" fill="#f6b04a" opacity="0.28" />}
      <rect x="9" y="27" width="22" height="16" rx="1" fill="#8a6a4f" />
      <path d="M9 31 H31 M9 35 H31 M9 39 H31" stroke="#6e523c" strokeWidth="0.8" />
      <path d="M5 29 L20 15.5 L35 29 Z" fill="#5a3b2a" />
      <path d="M5 29 L20 15.5 L35 29 L31.5 29 L20 19 L8.5 29 Z" fill="#ffffff" />
      <rect x="27" y="14" width="3.6" height="8" fill="#5a3b2a" />
      <rect x="26.5" y="13" width="4.6" height="2" rx="0.6" fill="#ffffff" />
      <rect x="12.5" y="31" width="7" height="6" rx="0.8" fill={night ? "#f6b04a" : "#cfe3f2"} />
      <path d="M16 31 V37 M12.5 34 H19.5" stroke="#8a6a4f" strokeWidth="0.9" />
      <path d="M23.5 43 V35.5 a3 3 0 0 1 6 0 V43 Z" fill="#3b2a1e" />
      <rect x="2" y="43" width="44" height="3.5" rx="1.75" fill="#f4f7fb" />
    </svg>
  );
}

/** Day-trip mark for the alpine set: a snowy summit with the sun over it. */
export function SnowPeakIcon({ className, rising = false }: P & { rising?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {rising && <circle cx="24" cy="26" r="14" fill="#f2c14e" opacity=".25" />}
      <circle cx={rising ? 24 : 34} cy={rising ? 26 : 13} r={rising ? 6.5 : 5} fill="#f2c14e" />
      <path d="M0 44 L16 18 L24 30 L31 21 L48 44 Z" fill="#2f4a6e" />
      <path d="M16 18 L21 26 L18.5 25 L16.3 28 L14 25 L11.4 26.3 Z M31 21 L35 27 L33 26.4 L31.2 28.6 L29.4 26.5 L27.6 27.2 Z" fill="#ffffff" />
      <path d="M0 48 V42 C10 37 20 38 26 41 C33 38 41 38 48 41 V48 Z" fill="#e9f0f8" />
    </svg>
  );
}

/** A snowy pine, the alpine set's poster decoration (like the palm for the tropics). */
export function Pine({ className }: P) {
  return (
    <svg viewBox="0 0 80 120" className={className} aria-hidden="true">
      <g fill="currentColor">
        <path d="M40 4 L58 34 H48 L66 62 H52 L74 96 H6 L28 62 H14 L32 34 H22 Z" />
        <rect x="35" y="96" width="10" height="20" rx="2" />
      </g>
      <path d="M40 4 L47 16 L42 14 L38 18 L33 14 Z M30 40 L38 36 L44 40 L50 36 L52 40 Z M22 70 L32 64 L40 70 L48 64 L58 70 Z" fill="rgb(255 255 255 / 0.55)" />
    </svg>
  );
}
