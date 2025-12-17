/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      fontSize: {
        sm: ['0.9375rem', '1.4'],
        base: ['1rem', '1.6'],
        lg: ['1.125rem', '1.75'],
        xl: ['1.25rem', '1.9'],
      },
      borderRadius: {
        'xl': '1rem',    // 16px
        '2xl': '1.75rem', // 28px
        '3xl': '2rem',    // 32px
        'full': '9999px',
      },
      colors: {
        // Material 3 Tonal Palette
        'primary': 'var(--color-primary)',
        'on-primary': 'var(--color-on-primary)',
        'primary-container': 'var(--color-primary-container)',
        'on-primary-container': 'var(--color-on-primary-container)',
        'secondary': 'var(--color-secondary)',
        'on-secondary': 'var(--color-on-secondary)',
        'secondary-container': 'var(--color-secondary-container)',
        'on-secondary-container': 'var(--color-on-secondary-container)',
        'tertiary': 'var(--color-tertiary)',
        'on-tertiary': 'var(--color-on-tertiary)',
        'tertiary-container': 'var(--color-tertiary-container)',
        'on-tertiary-container': 'var(--color-on-tertiary-container)',
        'error': 'var(--color-error)',
        'on-error': 'var(--color-on-error)',
        'error-container': 'var(--color-error-container)',
        'on-error-container': 'var(--color-on-error-container)',
        'background': 'var(--color-background)',
        'on-background': 'var(--color-on-background)',
        'surface': 'var(--color-surface)',
        'on-surface': 'var(--color-on-surface)',
        'surface-variant': 'var(--color-surface-variant)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        'outline': 'var(--color-outline)',
        'outline-variant': 'var(--color-outline-variant)',
        'shadow': 'var(--color-shadow)',
        'scrim': 'var(--color-scrim)',
        'inverse-surface': 'var(--color-inverse-surface)',
        'inverse-on-surface': 'var(--color-inverse-on-surface)',
        'inverse-primary': 'var(--color-inverse-primary)',
        // Custom surfaces for M3 elevation
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        'surface-container-low': 'var(--color-surface-container-low)',
        'surface-container': 'var(--color-surface-container)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'surface-container-highest': 'var(--color-surface-container-highest)',
        
        // Custom Colors
        'yellow-container': 'var(--color-yellow-container)',
        'on-yellow-container': 'var(--color-on-yellow-container)',

        // Legacy color mapping for smoother transition
        'destructive': 'var(--color-error)',
        'success': 'var(--color-tertiary)',
        'foreground': 'var(--color-on-surface)',
        'card': 'var(--color-surface-container-low)',
        'border': 'var(--color-outline-variant)',
        'muted': 'var(--color-surface-container)',
        'muted-foreground': 'var(--color-on-surface-variant)',
      }
    }
  }
}
