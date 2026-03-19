/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0ea5e9",
        "primary-dark": "#0284c7",
        mind: "#a855f7",
        body: "#22c55e",
        soul: "#f59e0b",
        work: "#0ea5e9",
      },
    },
  },
  plugins: [],
};
