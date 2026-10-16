/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), ink: v("ink"), muted: v("muted"), line: v("line"),
        cyan: v("cyan"), violet: v("violet"), pos: v("pos"), neg: v("neg"), amber: v("amber"), pink: v("pink"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--cyan) / .25), 0 8px 40px -8px rgb(var(--cyan) / .45)",
        glowv: "0 0 0 1px rgb(var(--violet) / .25), 0 8px 40px -8px rgb(var(--violet) / .45)",
      },
    },
  },
  plugins: [],
};
