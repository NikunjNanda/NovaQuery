/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#07090e",
      },
      fontFamily: {
        geist: ["Geist", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        editorial: ["Newsreader", "serif"],
      },
    },
  },
  plugins: [],
} 