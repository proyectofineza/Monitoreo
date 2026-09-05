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
        brand: '#4f8cff',
        brandsoft: 'rgba(79,140,255,.12)',
        green: '#34d399',
        greensoft: 'rgba(52,211,153,.14)',
        amber: '#fbbf24',
        ambersoft: 'rgba(251,191,36,.14)',
        orange: '#fb923c',
        orangesoft: 'rgba(251,146,60,.14)',
        red: '#f87171',
        redsoft: 'rgba(248,113,113,.14)',
      },
    },
  },
  plugins: [],
};
