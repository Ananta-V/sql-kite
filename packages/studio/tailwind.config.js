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
        'app-bg': '#0a0a0a',
        'app-sidebar': '#0f0f0f',
        'app-sidebar-hover': '#1a1a1a',
        'app-sidebar-active': '#2a2a2a',
        'app-border': '#1f1f1f',
        'app-text': '#e5e5e5',
        'app-text-dim': '#888888',
        'app-accent': '#3ecf8e',
        'app-accent-hover': '#34b179',
        'app-panel': '#0f0f0f',
        'app-panel-border': '#2a2a2a',
      }
    },
  },
  plugins: [],
}