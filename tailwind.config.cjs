/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F766E',
          light: '#14B8A6',
          dark: '#0B4E47',
        },
      },
    },
  },
  plugins: [],
};
