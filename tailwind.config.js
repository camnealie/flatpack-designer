/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // IBM Plex Sans was drawn for technical and industrial interfaces and
        // has figures to match, which is most of what this app displays.
        sans: [
          '"IBM Plex Sans"',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        // The chrome is deliberately cool and desaturated so the plywood in
        // the two viewports is the only warm thing on screen.
        console: '#eceff3',
        rule: '#d7dce2',
        graphite: '#1c2024',
        signal: '#1d4ed8',
      },
    },
  },
  plugins: [],
}
