/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['"Syne"', 'sans-serif'],
        raleway: ['"Raleway"', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#0F766E',
          light: '#14B8A6',
          dark: '#0B4E47',
        },
        bpas: {
          black: '#121212',
          grey: '#5a6061',
          light: '#eff2f7',
          yellow: '#eba000',
        },
      },
    },
  },
  plugins: [],
};
