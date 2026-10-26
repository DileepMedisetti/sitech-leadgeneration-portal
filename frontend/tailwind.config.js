/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/features/auth/**/*.{js,jsx,ts,tsx}",
    "./src/components/ui/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#c7d7fe',
          300: '#a4bcfd',
          400: '#7f9afb',
          500: '#4361ee',
          600: '#3651d4',
          700: '#283ca7',
          800: '#1d2a75',
          900: '#151d52',
          950: '#0d1337',
        },
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
