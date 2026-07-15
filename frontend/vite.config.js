import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        rooms: resolve(__dirname, 'rooms.html'),
        dining: resolve(__dirname, 'dining.html'),
        banquets: resolve(__dirname, 'banquets.html'),
        amenities: resolve(__dirname, 'amenities.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        contact: resolve(__dirname, 'contact.html'),
        book: resolve(__dirname, 'book.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
