/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#fca109',
        background: '#000000',
        border: '#374151',
        'card-foreground': '#ffffff',
        'muted-foreground': '#9ca3af',
        'foreground': '#ffffff',
        'accent': '#374151',
        ring: '#fca109',
        'secondary': '#374151',
        'secondary-foreground': '#d1d5db',
      },
    },
  },
  plugins: [],
};
