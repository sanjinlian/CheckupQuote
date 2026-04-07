/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#a7c6ed',
          100: '#7fb4e0',
          200: '#4a9cd4',
          300: '#2490bf',
          400: '#007bb8',
          500: '#005e99',
          600: '#003f7f',
          700: '#002b5c',
          800: '#001f4d',
          900: '#001a3e',
        },
      },
    },
  },
  plugins: [],
}

