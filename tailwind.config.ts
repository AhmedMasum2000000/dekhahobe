import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0A0A', 2: '#3F3F46', 3: '#71717A', 4: '#A1A1AA' },
        line: '#E9E9EC',
        mist: '#F6F6F7',
        brand: { DEFAULT: '#E6007E', dark: '#B80065', soft: '#FFE5F3' },
        ok: '#16A34A',
        warn: '#D97706',
        bad: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: { card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        marqueeRev: { from: { transform: 'translateX(-50%)' }, to: { transform: 'translateX(0)' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        marquee: 'marquee 60s linear infinite',
        marqueeRev: 'marqueeRev 60s linear infinite',
        rise: 'rise .25s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
