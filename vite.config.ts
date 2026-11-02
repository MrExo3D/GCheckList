import gsenderPlugin from '@sienci/gsender-plugin-sdk/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), gsenderPlugin()],
    // plugins are served from a subpath inside gSender
    base: './',
    // no rollupOptions.external here: gsenderPlugin() externalizes the SDK and
    // React itself, and an extra array makes the npm SDK bundle React twice
    build: {
        outDir: 'ui',
        emptyOutDir: true,
    },
});
