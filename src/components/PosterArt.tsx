import { memo, useId } from 'react';
import type { Poster } from '@/api';

// Original generative flyer art — six styles, deterministic from a seed.
// 'zine' is the Dekha Hobe collage look: black, hot pink halftone, red tape, Y2K star.
// No SVG filters or masks: phones (WebKit) render those into large offscreen buffers, and
// a page full of posters can exhaust memory and blank the view. Grain is a shared CSS tile.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.toUpperCase().replace(/[—–:]/g, ' ').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1]!.replace(/.{0,2}$/, '…');
    return kept;
  }
  return lines;
}

interface Props {
  poster: Poster;
  title: string;
  kicker?: string;
  className?: string;
  showText?: boolean;
}

export const PosterArt = memo(function PosterArt({ poster, title, kicker, className = '', showText = true }: Props) {
  const uidRaw = useId().replace(/:/g, '');
  if (poster.imageUrl) {
    return <img src={poster.imageUrl} alt={`${title} flyer`} className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  const r = rng(poster.seed);
  const [h1, h2] = poster.hues;
  const c1 = `hsl(${h1} 85% 58%)`;
  const c2 = `hsl(${h2} 90% 55%)`;
  const dark = `hsl(${h1} 60% 12%)`;
  const light = `hsl(${h2} 100% 92%)`;
  const lines = wrap(title, poster.style === 'type' ? 10 : 13, poster.style === 'type' ? 5 : 4);
  const fs = lines.length > 3 ? 40 : lines.length > 2 ? 46 : 54;
  const g = `g${uidRaw}`;

  const art = (() => {
    switch (poster.style) {
      case 'sun':
        return (
          <>
            <rect width="400" height="500" fill={`url(#${g})`} />
            <circle cx={120 + r() * 160} cy="210" r="120" fill={light} opacity=".95" />
            {Array.from({ length: 7 }, (_, i) => (
              <rect key={i} x="0" y={190 + i * 18} width="400" height={4 + i * 1.6} fill={c1} opacity=".9" />
            ))}
            <rect y="330" width="400" height="170" fill={dark} />
          </>
        );
      case 'grid':
        return (
          <>
            <rect width="400" height="500" fill={dark} />
            <rect width="400" height="260" fill={`url(#${g})`} opacity=".9" />
            {Array.from({ length: 13 }, (_, i) => (
              <line key={`v${i}`} x1={200} y1={260} x2={-400 + i * 100} y2={500} stroke={c2} strokeWidth="1.5" opacity=".7" />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <line key={`h${i}`} x1="0" x2="400" y1={260 + Math.pow(i, 1.8) * 6} y2={260 + Math.pow(i, 1.8) * 6} stroke={c2} strokeWidth="1.5" opacity=".7" />
            ))}
            <circle cx="200" cy="200" r="70" fill={light} opacity=".9" />
          </>
        );
      case 'wave':
        return (
          <>
            <rect width="400" height="500" fill={light} />
            {Array.from({ length: 6 }, (_, i) => {
              const y = 120 + i * 60;
              const a = 18 + r() * 30;
              return <path key={i} d={`M0 ${y} C 100 ${y - a}, 300 ${y + a}, 400 ${y} L400 500 L0 500 Z`} fill={i % 2 ? c1 : c2} opacity={0.55 + i * 0.08} />;
            })}
          </>
        );
      case 'zine':
        return (
          <>
            <rect width="400" height="500" fill="#0A0A0A" />
            {(() => {
              const cx = 250 + r() * 90;
              const cy = 150 + r() * 60;
              return (
                <>
                  <circle cx={cx} cy={cy} r="190" fill={`url(#d${uidRaw})`} />
                  <circle cx={cx} cy={cy} r="192" fill={`url(#f${uidRaw})`} />
                </>
              );
            })()}
            <rect x="-40" y={250 + r() * 50} width="520" height="46" fill="#E3001B" transform={`rotate(${-8 + r() * 5} 200 280)`} opacity=".92" />
            <rect x="-40" y={120 + r() * 40} width="300" height="18" fill={c1} transform={`rotate(${6 + r() * 4} 120 130)`} opacity=".85" />
            <g transform="translate(22 18) scale(1.05)">
              <path d="M19.5 4.9 L34.4 23.3 L54.6 18.1 L43.6 34.8 L58.5 53.3 L36.8 45.2 L25.8 61.8 L23.3 40.1 L1.7 31.9 L21.9 26.6Z" fill="none" stroke="#FA02A3" strokeWidth="4" strokeLinejoin="round" />
              <path d="M25.6 22.4 L32.1 30.2 L40.8 28.1 L36.3 35.4 L42.5 43.4 L33.2 40.0 L28.3 47.1 L27.1 37.8 L17.9 34.1 L26.4 31.7Z" fill="#FA02A3" />
            </g>
            <text x="92" y="52" fontSize="22" fontWeight="900" fill="#FA02A3" fontFamily="Anton, Inter Tight, Inter, sans-serif" letterSpacing="1">DEKHA HOBE.</text>
          </>
        );
      case 'type':
        return (
          <>
            <rect width="400" height="500" fill={c1} />
            {Array.from({ length: 9 }, (_, i) => (
              <text key={i} x={-20 + (i % 2) * 40} y={60 + i * 56} fontSize="64" fontWeight="900" fill={dark} opacity=".09" fontFamily="Inter Tight, Inter, sans-serif">
                {title.toUpperCase().slice(0, 14)}
              </text>
            ))}
            <circle cx={320} cy={90} r={50} fill={c2} />
          </>
        );
      default:
        return (
          <>
            <rect width="400" height="500" fill={`url(#${g})`} />
            {Array.from({ length: 4 }, (_, i) => (
              <circle key={i} cx={r() * 400} cy={r() * 380} r={90 + r() * 150} fill={`url(#${i % 2 ? 'bl' : 'bc'}${uidRaw})`} opacity={0.35 + r() * 0.4} />
            ))}
          </>
        );
    }
  })();

  const textColor = poster.style === 'wave' ? dark : '#fff';
  return (
    <span className={`relative block h-full w-full ${className}`}>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="block h-full w-full" role="img" aria-label={`${title} flyer`}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          <radialGradient id={`bl${uidRaw}`}>
            <stop offset="0" stopColor={light} />
            <stop offset=".5" stopColor={light} stopOpacity=".7" />
            <stop offset="1" stopColor={light} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`bc${uidRaw}`}>
            <stop offset="0" stopColor={c2} />
            <stop offset=".5" stopColor={c2} stopOpacity=".7" />
            <stop offset="1" stopColor={c2} stopOpacity="0" />
          </radialGradient>
          <pattern id={`d${uidRaw}`} width="11" height="11" patternUnits="userSpaceOnUse">
            <circle cx="5.5" cy="5.5" r="3.4" fill="#FA02A3" />
          </pattern>
          <radialGradient id={`f${uidRaw}`}>
            <stop offset=".35" stopColor="#0A0A0A" stopOpacity="0" />
            <stop offset=".8" stopColor="#0A0A0A" stopOpacity=".65" />
            <stop offset="1" stopColor="#0A0A0A" />
          </radialGradient>
        </defs>
        {art}
        {showText && (
          <g fontFamily="Anton, 'Inter Tight', Impact, sans-serif" fill={textColor}>
            {kicker && (
              <text x="28" y="44" fontSize="15" fontFamily="Inter, sans-serif" fontWeight="700" letterSpacing="3" opacity=".9">
                {kicker.toUpperCase()}
              </text>
            )}
            {lines.map((l, i) => (
              <text key={i} x="26" y={472 - (lines.length - 1 - i) * (fs * 1.02)} fontSize={fs} letterSpacing=".5" fill={poster.style === 'zine' && i === lines.length - 1 ? '#FA02A3' : undefined}>
                {l}
              </text>
            ))}
          </g>
        )}
      </svg>
      <span className="poster-grain" aria-hidden />
    </span>
  );
});
