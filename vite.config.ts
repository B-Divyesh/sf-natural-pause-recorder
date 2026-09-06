import { defineConfig } from 'vite';

export default defineConfig({
  preview: {
    // Vite preview is the browser-test stand-in for the static host, whose
    // content-hashed assets are immutable. This lets the offline test measure
    // the same first-visit cache behavior as the deployed PWA.
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 2048,
  },
});
