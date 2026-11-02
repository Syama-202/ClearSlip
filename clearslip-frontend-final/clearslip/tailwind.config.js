// Design tokens. Sizes come from Tailwind's rem scale (text-base = 16px),
// so the UI follows the browser's font-size setting. Text colours are
// chosen to pass WCAG AA contrast on the cream background.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        saffron: { 50: '#fff4ed', 100: '#ffe4c9', 500: '#ea580c', 600: '#c2410c', 700: '#9a3412' },
        maroon: { DEFAULT: '#9f1239', dark: '#881337', light: '#fbe9ee' },
        cream: '#fffbeb',
        peach: '#fff7ed',
        sand: '#fef3c7',       // highlighted card / table header
        line: '#fde68a',       // borders
        ink: '#1c1917',        // body text
        muted: '#57534e',      // secondary text (≈7:1 on cream)
        subtle: '#78716c',     // tertiary text (≈4.6:1 on cream)
        terra: '#7c2d12',      // headings
        good: '#15803d',
        bad: '#b91c1c',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        shimmer: { '0%, 100%': { opacity: 0.45 }, '50%': { opacity: 0.9 } },
        slideIn: { from: { transform: 'translateX(100%)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
