/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#fdf2f7",
          100: "#fce7f1",
          200: "#F8BBD9",
          300: "#F4A7C3",
          400: "#e879a8",
          500: "#C2185B",
          600: "#8B1A4A",
          700: "#6b1238",
          800: "#4a0d27",
          900: "#2d0818",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
}
