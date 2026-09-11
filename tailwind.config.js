/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Simnovus brand as real hex scales. The shadcn tokens above are CSS
        // variables holding hex, and Tailwind v3 cannot apply an opacity
        // modifier (bg-primary/10) to those — translucent brand accents use
        // these instead.
        brand: {
          orange: { DEFAULT: '#EC691F', 50: '#FDF1EA', 100: '#FBE1D2', 400: '#EF8A4F', 500: '#EC691F', 600: '#D95A11', 700: '#A8420A' },
          petrol: { DEFAULT: '#00303F', 800: '#16404E', 900: '#00303F', 950: '#002430' },
          teal:   { DEFAULT: '#17A5A2', 400: '#3FC1BE', 500: '#17A5A2', 600: '#0E8C89' },
          amber:  { DEFAULT: '#C98A1E', 400: '#EFC155', 500: '#C98A1E', 700: '#8A5B13' },
          mist:   { DEFAULT: '#CAE0E7' },
        },
        indigo: {
          '50': '#eef2ff',
          '100': '#e0e7ff',
          '200': '#c7d2fe',
          '300': '#a5b4fc',
          '400': '#818cf8',
          '500': '#6366f1',
          '600': '#4f46e5',
          '700': '#4338ca',
          '800': '#3730a3',
          '900': '#312e81',
          '950': '#1e1b4b',
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Simnovus pairing (next/font variables set on <body> in app/layout.tsx).
        sans: ['var(--font-sans)', 'Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        label: '.14em',   // the uppercase mono micro-labels (Kicker)
      },
      boxShadow: {
        glow: 'var(--glow)',
        accent: '0 6px 18px -8px rgb(236 105 31 / .8)',
      },
      minWidth: {
        'terminal': '600px'
      },
      minHeight: {
        'terminal': '400px'
      },
      maxWidth: {
        'terminal': '95vw'
      },
      maxHeight: {
        'terminal': '95vh'
      },
      animation: {
        'progress': 'progress 1s infinite linear',
        'spin': 'spin 1s linear infinite',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        spin: {
          to: { transform: 'rotate(360deg)' }
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' }
        }
      },
    },
  },
  plugins: [
    require("tailwindcss-animate")
  ],
  safelist: [
    {
      pattern: /^(bg|text|border|from|via|to)-(indigo|blue|green|red|gray|white|black)(-\d+)?/,
      variants: ['hover', 'dark', 'dark:hover'],
    },
  ],
};