/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff', 100: '#d9e6ff', 200: '#bcd3ff', 300: '#8eb5ff',
          400: '#588cff', 500: '#3366f2', 600: '#1f47d6', 700: '#1a37ab',
          800: '#1b3187', 900: '#1c2e6b',
        },
        surface: { DEFAULT: '#ffffff', muted: '#f6f7fb', border: '#e4e7ee' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
