/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design system tokens derived from videoframe_167.png
        'app-bg': '#F4F6FC',
        'brand-navy': '#1C2038',
      },
      borderRadius: {
        card: '24px',
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
