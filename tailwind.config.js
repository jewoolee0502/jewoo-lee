/** @type {import('tailwindcss').Config} */

import tailwindScrollbar from 'tailwind-scrollbar';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['"Crimson Pro"', 'serif'],
      },
      colors: {
        void: '#08080c',
        surface: '#111118',
        elevated: '#1a1a24',
        ridge: '#252530',
        ink: '#ede8e0',
        muted: '#8a847a',
        faint: '#4a4640',
        ember: '#e8572a',
        'ember-glow': '#ff6b3d',
      },
    },
  },
  plugins: [tailwindScrollbar],
}
