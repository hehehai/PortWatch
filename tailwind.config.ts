import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        }
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px'
      }
    }
  },
  plugins: []
} satisfies Config
