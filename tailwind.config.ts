import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        tech: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-surface-elevated)',
        },
        border: 'var(--border-hard)',
        text: {
          main: 'var(--text-main)',
          sub: 'var(--text-sub)',
          muted: 'var(--text-muted)',
        },
        // Neon fills (always paired with #0A0A0C text)
        accent: {
          pink: '#FF1A75',
          cyan: '#00F0FF',
          yellow: '#FFE600',
          mint: '#00E5A3',
          orange: '#FF8A00',
          purple: '#7928CA',
        },
        // Accent text colours that pass WCAG AA in both themes
        ink: {
          pink: 'var(--ink-pink)',
          cyan: 'var(--ink-cyan)',
          mint: 'var(--ink-mint)',
          orange: 'var(--ink-orange)',
          yellow: 'var(--ink-yellow)',
          purple: 'var(--ink-purple)',
        },
      },
      backgroundImage: {
        holo: 'var(--holo-prism)',
        chrome: 'var(--chrome-gradient)',
        haze: 'var(--dream-haze)',
      },
      boxShadow: {
        'brutal-sm': 'var(--solid-shadow-sm)',
        brutal: 'var(--solid-shadow)',
        'brutal-lg': 'var(--solid-shadow-lg)',
        'dream-aura': 'var(--dream-aura-shadow)',
      },
      borderWidth: {
        '2.5': '2.5px',
        '3': '3px',
      },
      animation: {
        'holo-sheen': 'holoSheen 4.5s infinite linear',
        'holo-shift': 'holoShift 3.5s infinite linear',
        'dream-float': 'dreamFloat 8s ease-in-out infinite',
      },
      keyframes: {
        holoSheen: {
          '0%': { transform: 'translateX(-150%)' },
          '30%': { transform: 'translateX(150%)' },
          '100%': { transform: 'translateX(150%)' },
        },
        holoShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '300% 50%' },
        },
        dreamFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
