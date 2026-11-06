import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
        secondary: { DEFAULT: "hsl(var(--secondary) / <alpha-value>)", foreground: "hsl(var(--secondary-foreground) / <alpha-value>)" },
        destructive: { DEFAULT: "hsl(var(--destructive) / <alpha-value>)", foreground: "hsl(var(--destructive-foreground) / <alpha-value>)" },
        muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
        accent: { DEFAULT: "hsl(var(--accent) / <alpha-value>)", foreground: "hsl(var(--accent-foreground) / <alpha-value>)" },
        popover: { DEFAULT: "hsl(var(--popover) / <alpha-value>)", foreground: "hsl(var(--popover-foreground) / <alpha-value>)" },
        card: { DEFAULT: "hsl(var(--card) / <alpha-value>)", foreground: "hsl(var(--card-foreground) / <alpha-value>)" },
        brand: { DEFAULT: "hsl(var(--brand) / <alpha-value>)", foreground: "hsl(var(--brand-foreground) / <alpha-value>)" },
        night: { 50: "#eef2f9", 100: "#d8e0ef", 200: "#aebfdc", 400: "#5a73a3", 600: "#25365c", 800: "#121c33", 900: "#0b1222", 950: "#070c17" },
        turquoise: { 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488" },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        sidebar: { DEFAULT: "hsl(var(--sidebar) / <alpha-value>)", foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)", muted: "hsl(var(--sidebar-muted) / <alpha-value>)", border: "hsl(var(--sidebar-border) / <alpha-value>)" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)", xl: "calc(var(--radius) + 4px)", "2xl": "calc(var(--radius) + 8px)" },
      boxShadow: {
        soft: "0 1px 2px rgb(11 18 34 / 0.04), 0 4px 16px -4px rgb(11 18 34 / 0.08)",
        glow: "0 0 0 1px hsl(var(--brand) / 0.25), 0 8px 24px -8px hsl(var(--brand) / 0.45)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: { "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out" },
    },
  },
  plugins: [animate],
};

export default config;
