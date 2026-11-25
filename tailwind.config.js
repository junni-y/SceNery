/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: '#f8f9fa',
        gridDot: '#cbd5e1',
      }
    },
  },
  plugins: [],
}