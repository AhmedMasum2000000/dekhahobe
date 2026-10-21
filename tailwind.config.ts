import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          2: 'rgb(var(--ink-2) / <alpha-value>)',
          3: 'rgb(var(--ink-3) / <alpha-value>)',
          4: 'rgb(var(--ink-4) / <alpha-value>)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        action: 'rgb(var(--action) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        mist: 'rgb(var(--mist) / <alpha-value>)',
        // B-POP TAGS palette, sampled from the brand logo
        brand: { DEFAULT: '#FA02A3', dark: '#C4007F', soft: 'rgb(var(--brand-soft) / <alpha-value>)', light: 'rgb(var(--brand-light) / <alpha-value>)' },
        pop: { red: '#E3001B', cream: '#FFFAF3' },
        ok: '#16A34A',
        warn: '#D97706',
        bad: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter Variable', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        display: ['Inter Variable', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        poster: ['Anton', 'Impact', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: { card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        marqueeRev: { from: { transform: 'translateX(-50%)' }, to: { transform: 'translateX(0)' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        twinkle: { '0%,100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' }, '50%': { transform: 'scale(.7) rotate(20deg)', opacity: '.6' } },
      },
      animation: {
        marquee: 'marquee 60s linear infinite',
        marqueeRev: 'marqueeRev 60s linear infinite',
        rise: 'rise .25s ease-out both',
        twinkle: 'twinkle 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
