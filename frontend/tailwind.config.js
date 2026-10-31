/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: 'var(--color-accent)',
        'app-bg': 'var(--color-bg)',
        'app-text': 'var(--color-text)',
        'app-surface': 'var(--color-surface)',
        'app-border': 'var(--color-border)',
        'app-muted': 'var(--color-muted)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

