import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: c('bg'),
        ink: c('fg'),
        muted: c('muted'),
        card: c('card'),
        line: c('border'),
        chord: c('chord'),
        accent: c('accent'),
        accentfg: c('accent-fg'),
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.08), 0 8px 28px rgb(0 0 0 / 0.14)',
        lift: '0 2px 4px rgb(0 0 0 / 0.08), 0 14px 36px rgb(0 0 0 / 0.2)',
      },
    },
  },
  plugins: [],
};
export default config;
