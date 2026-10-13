/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        carbon: {
          clean: "#10b981",    // Emerald
          moderate: "#f59e0b", // Amber
          dirty: "#ef4444",    // Red
        },
      },
    },
  },
  plugins: [],
}
