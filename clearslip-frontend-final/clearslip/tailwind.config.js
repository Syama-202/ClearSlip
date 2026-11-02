export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        saffron: { 50: '#fff4ed', 100: '#ffe4c9', 500: '#ea580c', 600: '#c2410c', 700: '#9a3412' },
        cream: '#fffbeb',
        ycard: '#fef3c7',
        amberb: '#fde68a',
        maroon: { DEFAULT: '#9f1239', dark: '#7c2d12', light: '#fbe9ee' },
        peach: '#fff7ed',
        rust: '#c2410c',
        terra: '#7c2d12',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: { shimmer: 'shimmer 1.5s infinite' },
      keyframes: { shimmer: { '0%': { opacity: 0.5 }, '50%': { opacity: 1 }, '100%': { opacity: 0.5 } } },
    },
  },
  plugins: [],
}
