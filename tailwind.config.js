/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Cyberpunk theme colors
        cyber: {
          yellow: '#FFD700',
          orange: '#FF6B35',
          teal: '#00D4AA',
          green: '#00D4AA',
          purple: '#9D4EDD',
          pink: '#FF2E63',
          blue: '#4361EE',
          black: '#0A0A0A',
          dark: '#111111',
          card: '#1A1A1A',
          border: '#2A2A2A',
          gray: '#888888',
          white: '#E8E8E8',
          'gray-light': '#2A2A2A',
        },
        // Status colors
        status: {
          active: '#10B981',
          idle: '#F59E0B',
          error: '#EF4444',
          warning: '#F97316',
          success: '#22C55E',
          info: '#3B82F6',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
        '3xs': '0.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-out': 'slide-out 0.3s ease-in',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-in',
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px theme(colors.cyber.yellow), 0 0 10px theme(colors.cyber.yellow)',
          },
          '50%': {
            boxShadow: '0 0 10px theme(colors.cyber.yellow), 0 0 20px theme(colors.cyber.yellow)',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        'slide-out': {
          '0%': { transform: 'translateX(0)', opacity: 1 },
          '100%': { transform: 'translateX(100%)', opacity: 0 },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'fade-out': {
          '0%': { opacity: 1 },
          '100%': { opacity: 0 },
        },
        'heartbeat': {
          '0%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(1.1)', opacity: 0.8 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        'border-glow': {
          '0%, 100%': {
            borderColor: 'theme(colors.cyber.teal)',
            boxShadow: '0 0 5px theme(colors.cyber.teal)',
          },
          '50%': {
            borderColor: 'theme(colors.cyber.blue)',
            boxShadow: '0 0 10px theme(colors.cyber.blue)',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
        'cyber-grid': 'linear-gradient(90deg, rgba(0,212,170,0.1) 1px, transparent 1px), linear-gradient(0deg, rgba(0,212,170,0.1) 1px, transparent 1px)',
        'noise': "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')",
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'cyber': '0 0 15px rgba(0, 212, 170, 0.3), 0 0 30px rgba(0, 212, 170, 0.1)',
        'cyber-lg': '0 0 30px rgba(0, 212, 170, 0.5), 0 0 60px rgba(0, 212, 170, 0.2)',
        'cyber-xl': '0 0 50px rgba(0, 212, 170, 0.7), 0 0 100px rgba(0, 212, 170, 0.3)',
        'glow-yellow': '0 0 10px theme(colors.cyber.yellow), 0 0 20px theme(colors.cyber.yellow)',
        'glow-orange': '0 0 10px theme(colors.cyber.orange), 0 0 20px theme(colors.cyber.orange)',
        'glow-teal': '0 0 10px theme(colors.cyber.teal), 0 0 20px theme(colors.cyber.teal)',
        'inner-cyber': 'inset 0 2px 4px 0 rgba(0, 212, 170, 0.1)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 212, 170, 0.3)',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'grid': 'grid-template-rows, grid-template-columns',
      },
      gridTemplateColumns: {
        'agent-grid': 'repeat(auto-fill, minmax(300px, 1fr))',
        'workspace-grid': 'repeat(auto-fill, minmax(250px, 1fr))',
        'stats-grid': 'repeat(auto-fit, minmax(200px, 1fr))',
      },
      zIndex: {
        'max': '9999',
        'modal': '1000',
        'dropdown': '500',
        'header': '100',
        'base': '1',
        'negative': '-1',
      },
    },
  },
  plugins: [],
}