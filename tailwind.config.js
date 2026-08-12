/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design system tokens derived from videoframe_167.png.
        // `app-bg` and the semantic surface/content tokens are backed by CSS
        // variables (see src/index.css) so they mirror automatically in dark
        // mode. `brand-navy` stays a fixed brand color (used for the wordmark
        // and primary buttons); dark-mode text legibility is handled by the
        // dark override layer in index.css.
        'app-bg': 'rgb(var(--app-bg) / <alpha-value>)',
        'brand-navy': '#1C2038',
        // Semantic tokens (flip in dark mode via CSS variables).
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        content: 'rgb(var(--content) / <alpha-value>)',
        'content-muted': 'rgb(var(--content-muted) / <alpha-value>)',
        // Feature-card gradient stops (design.md — dual-tone gradient cards).
        coral: '#FF7E7E',
        peach: '#FFB27E',
        'sky-brand': '#7EA8FF',
        'royal-brand': '#4F5BE0',
        magenta: '#E85CC4',
        'pink-brand': '#FF8FCf',
      },
      borderRadius: {
        card: '24px',
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.04)',
        'card-dark': '0 10px 30px rgba(0,0,0,0.35)',
        glow: '0 8px 24px rgba(79,91,224,0.45)',
      },
      backgroundImage: {
        // Dual-tone gradient feature cards (design.md; R21.3).
        'feature-coral': 'linear-gradient(135deg, #FF7E7E 0%, #FFB27E 100%)',
        'feature-sky': 'linear-gradient(135deg, #7EA8FF 0%, #4F5BE0 100%)',
        'feature-magenta': 'linear-gradient(135deg, #E85CC4 0%, #FF8FCF 100%)',
        // Elevated circular gradient FAB.
        'fab-gradient': 'linear-gradient(135deg, #6D78F0 0%, #4F5BE0 100%)',
      },
    },
  },
  plugins: [],
};
