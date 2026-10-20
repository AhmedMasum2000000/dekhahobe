import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0A0A', 2: '#3F3F46', 3: '#71717A', 4: '#A1A1AA' },
        line: '#E9E9EC',
        mist: '#F6F6F7',
        // B-POP TAGS palette, sampled from the brand logo
        brand: { DEFAULT: '#FA02A3', dark: '#C4007F', soft: '#FED7EF', light: '#FFF0F8' },
        pop: { red: '#E3001B', cream: '#FFFAF3' },
        ok: '#16A34A',
        warn: '#D97706',
        bad: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        poster: ['Anton', '"Inter Tight"', 'Impact', 'sans-serif'],
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
