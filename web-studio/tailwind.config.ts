import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/remotion/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        apple: {
          dark: "#0E0E10",
          card: "#18181B",
          border: "#27272A",
          accent: "#0071E3",
          hover: "#0077ED",
          textSecondary: "#A1A1AA"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        animation: ["var(--font-be-vietnam-pro)", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
