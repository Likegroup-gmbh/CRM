import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        kundenRegister: 'src/auth/kunden-register.html',
        verifyEmail: 'src/auth/verify-email.html',
        confirmEmail: 'src/auth/confirm-email.html'
      },
      output: {
        manualChunks: {
          core: ['src/core/FilterSystem.js', 'src/core/FilterConfig.js', 'src/core/FilterLogic.js', 'src/core/FilterUI.js'],
          auth: ['src/modules/auth/AuthService.js', 'src/modules/auth/AuthUtils.js'],
          modules: ['src/modules/creator/CreatorList.js']
        }
      }
    }
  },
  publicDir: 'public',
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
}); 