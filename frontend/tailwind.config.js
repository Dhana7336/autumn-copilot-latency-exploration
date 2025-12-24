/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lavender: {
          50: '#faf8fc',
          100: '#f5f0fa',
          200: '#e9dff4',
          300: '#d8c4e9',
          400: '#c099dd',
          500: '#a07fc5',
          600: '#8866aa',
          700: '#6f4d8f',
          800: '#5a3e75',
          900: '#4a335f',
        },
      },
    },
  },
  plugins: [],
}