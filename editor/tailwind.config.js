/** @type {import('tailwindcss').Config} */
//
// ArtCade GUI Style Guide compliance — global Tailwind theme overrides.
//
//   • Border-radius capped at 2px to satisfy "geometrie squadrate".
//     We keep token names (rounded, rounded-md, rounded-lg, ...) so existing
//     components do not need rewrites — they all collapse to ≤ 2px.
//
//   • Font families wired to the official CSS variables so `font-sans`,
//     `font-mono` and `font-ui` opt into the correct family.
//
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-ui)'],
        ui:   ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        none: '0',
        sm:   '0',
        DEFAULT: '2px',
        md:   '2px',
        lg:   '2px',
        xl:   '2px',
        '2xl': '2px',
        '3xl': '2px',
        full: '9999px', // kept for circular avatars/dots only
      },
    },
  },
  plugins: [],
}
