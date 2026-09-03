import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: "#0D1117", // app background
        panel: "#161B22", // sidebar, toolbars, table headers
        "panel-raised": "#1C2129", // hover / active row surface
        border: "#30363D",
        borderMuted: "#21262D",

        // Text
        "text-primary": "#E6EDF3",
        "text-secondary": "#8B949E",
        "text-muted": "#6E7681",

        // Brand — purple to blue
        primary: "#8B5CF6",
        "primary-hover": "#9D74F8",
        secondary: "#3B82F6",

        // Semantic
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",

        // HTTP method colors
        method: {
          get: "#10B981",
          post: "#3B82F6",
          put: "#F59E0B",
          patch: "#8B5CF6",
          delete: "#EF4444",
          ws: "#10B981",
          grpc: "#F97316",
          graphql: "#E10098",
          query: "#06B6D4",
        },
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "8px",
        lg: "10px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        xs: "11px",
        sm: "12.5px",
        base: "13.5px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0,0,0,0.4)",
        elevated: "0 8px 24px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
