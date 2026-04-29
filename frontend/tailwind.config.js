/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f1f7ee',
          100: '#dcecd2',
          400: '#62a850',
          500: '#3f8a2f',
          600: '#2f6b22',
          700: '#23521b',
        },
      },
    },
  },
  plugins: [],
}

