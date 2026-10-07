import type { Config } from "tailwindcss";

/**
 * Design tokens. Radii follow the portal's scale: 8px controls (rounded-lg), 12px cards (rounded-xl)
 * and 16px dialogs (rounded-2xl), which are Tailwind's defaults.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#272147",
        secondary: "#3a316a",
        accent: {
          DEFAULT: "#4d418d",
          hover: "#5d50a8",
          active: "#433880",
          soft: "#f1effa",
          tint: "#f6f4fd",
        },
        dark: "#141124",
        canvas: "#f6f5fa",
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#fbfbfd",
          hover: "#f8f7fc",
        },
        ink: {
          DEFAULT: "#1a1733",
          soft: "#2f2a52",
          nav: "#4a4668",
        },
        muted: "#6b6899",
        faint: "#b3aed0",
        line: {
          DEFAULT: "#e7e5f0",
          strong: "#dcd9ea",
          soft: "#efedf5",
        },
        danger: {
          DEFAULT: "#b4232f",
          strong: "#8f1d27",
          soft: "#fdf3f4",
          border: "#f3d3d6",
        },
        success: {
          DEFAULT: "#1d7a4a",
          soft: "#e9f6ef",
          border: "#c9e9d6",
        },
        warning: {
          DEFAULT: "#7a5300",
          soft: "#fdf8ec",
          border: "#f0d9a8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 17, 36, 0.04)",
        control: "0 1px 1px rgba(20, 17, 36, 0.03)",
        raised: "0 14px 32px -18px rgba(39, 33, 71, 0.4)",
        popover: "0 14px 32px -12px rgba(39, 33, 71, 0.35)",
        dialog: "0 24px 48px -16px rgba(20, 17, 36, 0.35)",
      },
      maxWidth: {
        content: "1500px",
      },
      backgroundImage: {
        "select-chevron":
          "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b6899' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
      },
      keyframes: {
        "drawer-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "sheet-in": { from: { transform: "translateY(24px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "drawer-in": "drawer-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "sheet-in": "sheet-in 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
