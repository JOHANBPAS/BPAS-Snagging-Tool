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
          DEFAULT: '#eba000', // BPAS Yellow
          light: '#f5b029',
          dark: '#c78800',
        },
        bpas: {
          black: '#121212',
          grey: '#5a6061',
          light: '#eff2f7',
          yellow: '#eba000',
        },
      },
      screens: {
        // Increase lg breakpoint so iPads in landscape (up to ~1194px) use mobile/tablet layout
        'lg': '1280px',
      },
    },
  },
  plugins: [],
};
