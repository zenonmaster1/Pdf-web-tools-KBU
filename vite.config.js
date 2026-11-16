import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Configure Vite with React, Tailwind CSS v4, and target iOS 14+ / older Android Chrome
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Listen on all network addresses (0.0.0.0) for testing on mobile via Wi-Fi
    port: 5173,
  },
  build: {
    target: ['es2020', 'chrome87', 'safari14', 'firefox78', 'edge88'],
  },
})
