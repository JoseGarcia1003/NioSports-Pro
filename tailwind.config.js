/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-abyss': '#030711',
        'bg-deep': '#050b18',
        'bg-base': '#0a1628',
        'bg-raised': '#0d1f3c',
        'bg-surface': '#132952',
        'bg-hover': '#1a3566',
        'gold': '#FFD700',
        'gold-vivid': '#FFE44D',
        'gold-warm': '#FFAA00',
        'gold-ember': '#F59E0B',
        'cyan': '#22d3ee',
        'emerald': '#34d399',
        'rose': '#f43f5e',
        'violet': '#a78bfa',
        'amber': '#fbbf24',
      },
    },
  },
  plugins: [],
}
