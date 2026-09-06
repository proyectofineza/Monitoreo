/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: '#0a0e14',
        surface: '#10161f',
        surface2: '#161d29',
        surface3: '#1c2430',
        border: '#232c3a',
        bordersoft: '#1a212c',
        text: '#e8ecf2',
        text2: '#8b96a8',
        text3: '#5a6474',
        brand: '#5b6bff',
        brand2: '#8b5cf6',
        brandsoft: 'rgba(91,107,255,.16)',
        green: '#22e2a0',
        greensoft: 'rgba(34,226,160,.15)',
        amber: '#ffc736',
        ambersoft: 'rgba(255,199,54,.15)',
        orange: '#ff8a3d',
        orangesoft: 'rgba(255,138,61,.15)',
        red: '#ff5468',
        redsoft: 'rgba(255,84,104,.15)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,84,104,.55)' },
          '50%': { boxShadow: '0 0 0 7px rgba(255,84,104,0)' },
        },
        'pop-in': {
          '0%': { opacity: 0, transform: 'translateY(4px) scale(.98)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        breathe: 'breathe 1.7s ease-in-out infinite',
        'pop-in': 'pop-in .18s ease-out',
      },
    },
  },
  plugins: [],
};
