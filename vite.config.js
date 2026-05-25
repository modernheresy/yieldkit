import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        yield:      resolve(__dirname, 'yield.html'),
        section24:  resolve(__dirname, 'section24.html'),
        stress:     resolve(__dirname, 'stress.html')
      },
    },
  },
})
