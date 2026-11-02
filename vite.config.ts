import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// `vite build --mode android` gera o bundle embutido no APK (sem Service Worker,
// já que o Capacitor serve os arquivos localmente). O build web normal gera o PWA.
export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android';

  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [
      react(),
      tailwindcss(),
      !isAndroid &&
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
          manifest: {
            id: '/',
            name: 'NexusMIDI Pro',
            short_name: 'NexusMIDI',
            description: 'Hub MIDI e sintetizador SoundFont para Android e Web.',
            lang: 'pt-BR',
            theme_color: '#0a0e1a',
            background_color: '#0a0e1a',
            display: 'standalone',
            orientation: 'landscape',
            start_url: '/',
            scope: '/',
            icons: [
              { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              {
                src: '/icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            // O processador do SpessaSynth é um arquivo grande; sem isso ele não entra no cache offline.
            maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          },
          devOptions: { enabled: false },
        }),
    ],
  };
});
