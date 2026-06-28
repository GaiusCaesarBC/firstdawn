/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        dawn: {
          gold: "#d8ad5f",
          amber: "#f1c978",
          coal: "#060708",
          ink: "#0d1117",
          mist: "#b9c0bf",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ember: "0 0 42px rgba(216, 173, 95, 0.18)",
      },
    },
  },
  plugins: [],
};
