/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--q-ink)",
        deep: "var(--q-deep)",
        "deep-2": "var(--q-deep-2)",
        mid: "var(--q-mid)",
        soft: "var(--q-soft)",
        "soft-2": "var(--q-soft-2)",
        gold: "var(--q-gold)",
        "gold-deep": "var(--q-gold-deep)",
        "gold-soft": "var(--q-gold-soft)",
        bg: "var(--q-bg)",
        paper: "var(--q-paper)",
        card: "var(--q-card)",
        line: "var(--q-line)",
        "line-2": "var(--q-line-2)",
        text: "var(--q-text)",
        "text-2": "var(--q-text-2)",
        "text-3": "var(--q-text-3)",
        warn: "var(--q-warn)",
        bad: "var(--q-bad)",
        good: "var(--q-good)",
      },
      fontFamily: {
        sans: ["Inter Tight", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        serif: ["Fraunces", "Times New Roman", "Times", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        "r-sm": "6px",
        "r-md": "12px",
        "r-lg": "20px",
        "r-xl": "28px",
      },
    },
  },
  plugins: [],
};
