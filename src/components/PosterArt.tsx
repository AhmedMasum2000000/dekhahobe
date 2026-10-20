import { memo, useId } from 'react';
import type { Poster } from '@/api';

// Original generative flyer art — five styles, deterministic from a seed.
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
  const lines = wrap(title, poster.style === 'type' ? 9 : 12, poster.style === 'type' ? 5 : 4);
  const fs = lines.length > 3 ? 40 : lines.length > 2 ? 46 : 54;
  const g = `g${uidRaw}`;
  const n = `n${uidRaw}`;

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
              <circle key={i} cx={r() * 400} cy={r() * 380} r={60 + r() * 120} fill={i % 2 ? light : c2} opacity={0.25 + r() * 0.3} filter={`url(#b${uidRaw})`} />
            ))}
          </>
        );
    }
  })();

  const textColor = poster.style === 'wave' ? dark : '#fff';
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className={`h-full w-full ${className}`} role="img" aria-label={`${title} flyer`}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <filter id={`b${uidRaw}`}>
          <feGaussianBlur stdDeviation="30" />
        </filter>
        <filter id={n}>
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .18 0" />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
      </defs>
      {art}
      <rect width="400" height="500" filter={`url(#${n})`} />
      {showText && (
        <g fontFamily="Inter Tight, Inter, sans-serif" fill={textColor}>
          {kicker && (
            <text x="28" y="44" fontSize="15" fontWeight="700" letterSpacing="3" opacity=".9">
              {kicker.toUpperCase()}
            </text>
          )}
          {lines.map((l, i) => (
            <text key={i} x="26" y={472 - (lines.length - 1 - i) * (fs * 0.95)} fontSize={fs} fontWeight="900" letterSpacing="-1">
              {l}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
});
