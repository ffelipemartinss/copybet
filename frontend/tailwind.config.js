/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#38bdf8',
        dark: '#0f172a',
        card: '#1e293b',
        border: '#334155',
        muted: '#94a3b8',
      },
    },
  },
  plugins: [],
}
