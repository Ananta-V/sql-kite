/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'studio-bg': '#1a1a1a',
        'studio-sidebar': '#0f0f0f',
        'studio-border': '#2a2a2a',
        'studio-hover': '#262626',
        'studio-active': '#2d2d2d',
        'studio-text': '#e5e5e5',
        'studio-text-dim': '#a3a3a3',
        'studio-accent': '#3ecf8e',
        'studio-accent-hover': '#34b179',
      }
    },
  },
  plugins: [],
}