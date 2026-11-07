/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          bg: 'var(--bg)', surface: 'var(--surface)', glass: 'var(--glass)',
          border: 'var(--border)', primary: 'var(--primary)', secondary: 'var(--secondary)',
          accent: 'var(--accent)', warm: 'var(--warm)', text: 'var(--text)', muted: 'var(--muted)',
          calories: 'var(--calories)', protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)',
          water: 'var(--water)', sleep: 'var(--sleep)', workout: 'var(--workout)'
        },
        brand: {
          light: '#F8FAF9',
          primary: '#4CAF50',
          dark: '#2E7D32',
          accent: '#FFC107',
        }
      }
    },
  },
  plugins: [],
}
