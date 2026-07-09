/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    { DEFAULT: '#1C2E4A', 50: '#EDF0F5', 100: '#C5CEDD', 200: '#9DADC5', 300: '#758BAD', 400: '#4D6A94', 500: '#1C2E4A', 600: '#162540', 700: '#101B31', 800: '#0B1222', 900: '#050912' },
        gold:    { DEFAULT: '#F7B731', 50: '#FEF9EC', 100: '#FDEFC8', 200: '#FBE09F', 300: '#FAD077', 400: '#F8C354', 500: '#F7B731', 600: '#E8A308', 700: '#C08807', 800: '#977D06', 900: '#6F5E04' },
        surface: '#F8F9FB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgb(0 0 0 / .07), 0 1px 2px -1px rgb(0 0 0 / .07)',
        'card-hover': '0 4px 16px 0 rgb(0 0 0 / .10)',
      },
      borderRadius: {
        xl:  '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
