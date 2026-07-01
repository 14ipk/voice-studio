/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 暗夜实验室底色
        ink: {
          950: "#06060A",
          900: "#0A0A0F",
          850: "#0F0F17",
          800: "#14141D",
          750: "#1A1A26",
          700: "#22222F",
          600: "#2E2E3E",
          500: "#3D3D50",
          400: "#5A5A70",
        },
        // 霓虹青绿 主强调
        neon: {
          50: "#E6FFF8",
          100: "#B3FFEC",
          200: "#80FFDF",
          300: "#4DFFD3",
          400: "#1AFFC6",
          500: "#00F0B5",
          600: "#00C994",
          700: "#009970",
          800: "#006652",
          900: "#003329",
        },
        // 品红 次强调
        magenta: {
          50: "#FFE6F2",
          100: "#FFB3D9",
          200: "#FF80BF",
          300: "#FF4DA6",
          400: "#FF2D7E",
          500: "#E61F66",
          600: "#B81952",
          700: "#8A133D",
          800: "#5C0C29",
          900: "#2E0614",
        },
        amber: {
          400: "#FFB547",
          500: "#FF9D1A",
        },
      },
      fontFamily: {
        display: ['"Outfit"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        body: ['"Outfit"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Noto Sans Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        "neon-sm": "0 0 8px rgba(0, 240, 181, 0.35)",
        neon: "0 0 18px rgba(0, 240, 181, 0.45), 0 0 36px rgba(0, 240, 181, 0.18)",
        "neon-lg": "0 0 28px rgba(0, 240, 181, 0.6), 0 0 56px rgba(0, 240, 181, 0.25)",
        "magenta-sm": "0 0 8px rgba(255, 45, 126, 0.35)",
        magenta: "0 0 18px rgba(255, 45, 126, 0.45), 0 0 36px rgba(255, 45, 126, 0.18)",
        "panel": "inset 0 1px 0 0 rgba(255,255,255,0.04), 0 8px 24px -8px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(0,240,181,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,181,0.04) 1px, transparent 1px)",
        "radial-neon":
          "radial-gradient(circle at 20% 20%, rgba(0,240,181,0.10), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,45,126,0.08), transparent 40%)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan": "scan 2.4s ease-in-out infinite",
        "drift": "drift 12s ease-in-out infinite alternate",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        scan: {
          "0%, 100%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { transform: "translateY(100%)", opacity: "1" },
        },
        drift: {
          "0%": { transform: "translate3d(0,0,0) scale(1)" },
          "100%": { transform: "translate3d(2%, -2%, 0) scale(1.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
