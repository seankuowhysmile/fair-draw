import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file offline build: every asset gets inlined into one dist/index.html,
// matching the v1 build.py contract (no server, double-click to run).
export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
  },
});
