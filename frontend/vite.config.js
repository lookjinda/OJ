import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    base: '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    },
    server: {
        host: '0.0.0.0',
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/media': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
