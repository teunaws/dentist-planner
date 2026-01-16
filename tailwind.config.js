/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './src/app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f3f5ff',
          100: '#e4e8ff',
          200: '#c8d0f5',
          300: '#a6b5e6',
          400: '#7f90cb',
          500: '#606fac',
          600: '#4b558b',
          700: '#40466f',
          800: '#323752',
          900: '#1f2233',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 25px 50px -12px rgba(15, 23, 42, 0.45)',
      },
      backgroundImage: {
        'mesh-gradient':
          'radial-gradient(circle at 15% 20%, rgba(16,185,129,0.35), transparent 45%), radial-gradient(circle at 85% 30%, rgba(59,130,246,0.35), transparent 50%), radial-gradient(circle at 20% 80%, rgba(244,114,182,0.35), transparent 45%), radial-gradient(circle at 80% 80%, rgba(248,113,113,0.3), transparent 60%)',
      },
    },
  },
  plugins: [],
}
