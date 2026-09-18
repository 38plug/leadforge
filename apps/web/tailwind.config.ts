import type { Config } from "tailwindcss";

/**
 * Every colour resolves to a CSS variable defined in globals.css, so the
 * palette has exactly one source of truth and opacity modifiers
 * (bg-primary/15) still compose.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // The two panel levels, so depth is chosen by name rather than by
        // guessing at a slightly different grey each time.
        surface: {
          DEFAULT: "hsl(var(--surface))",
          elevated: "hsl(var(--surface-elevated))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        subtle: {
          foreground: "hsl(var(--subtle-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        // Derived from one --radius so a control nested in a panel is always
        // slightly tighter than the panel around it.
        "2xl": "calc(var(--radius) + 4px)",
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 5px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        // Named by what the element is doing, not by size.
        panel: "inset 0 1px 0 0 hsl(0 0% 100% / 0.04), 0 1px 2px 0 hsl(0 0% 0% / 0.4)",
        raised: "inset 0 1px 0 0 hsl(0 0% 100% / 0.05), 0 16px 48px -12px hsl(0 0% 0% / 0.7)",
        accent: "0 6px 24px -10px hsl(var(--glow-strong) / 0.85)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // Dashboard-density additions; the default scale starts too large
        // for table cells and metric labels.
        "2xs": ["11px", { lineHeight: "1.45" }],
      },
      transitionTimingFunction: {
        // Decelerating curve used for entrances across the app.
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
