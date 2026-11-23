/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          primary: '#1ed760',
          'primary-hover': '#1fdf64',
          secondary: '#ffffff',
          tertiary: '#7c7c7c',
          neutral: '#121212',
          surface: '#242424',
          'surface-highlight': '#2a2a2a',
          'surface-elevated': '#333333',
          'on-surface': '#b3b3b3',
          error: '#ff4d4f',
          border: '#374151',
          overlay: '#000000',
        },
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'full': '9999px',
      },
      spacing: {
        'xs': '6px',
        'sm': '16px',
        'md': '28px',
        'lg': '48px',
        'xl': '172px',
      },
      fontFamily: {
        sans: [
          'SpotifyMixUI',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        title: [
          'SpotifyMixUITitle',
          'SpotifyMixUI',
          'Inter',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
