/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        es: { DEFAULT: '#16a34a', dark: '#166534', light: '#dcfce7', bg: '#f0fdf4' },
      },
    },
  },
  plugins: [],
};
