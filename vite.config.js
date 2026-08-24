import { defineConfig } from 'vite';

/** Vite Dev serviert Source-CJS roh. Default-Import aus der UI braucht export default. */
function cjsSharedAsDefault() {
  return {
    name: 'cjs-shared-as-default',
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (!file.includes('/netlify/functions/_shared/') || !file.endsWith('.js')) return null;
      if (!/\bmodule\.exports\s*=/.test(code)) return null;
      return {
        code: `${code.replace(/\bmodule\.exports\s*=/, 'const __cjs_exports =')}\nexport default __cjs_exports;\n`,
        map: null
      };
    }
  };
}

export default defineConfig({
  plugins: [cjsSharedAsDefault()],
  root: '.',
  build: {
    outDir: 'dist',
    // Shared CJS unter netlify/functions (z. B. skript-creator-facing)
    // sonst: "X is not exported" im Production-Build.
    commonjsOptions: {
      include: [/node_modules/, /netlify\/functions/]
    },
    rollupOptions: {
      input: {
        main: 'index.html',
        kundenRegister: 'src/auth/kunden-register.html',
        magicRegister: 'src/auth/magic-register.html',
        verifyEmail: 'src/auth/verify-email.html',
        confirmEmail: 'src/auth/confirm-email.html',
        resetPassword: 'src/auth/reset-password.html'
      },
      output: {
        manualChunks: {
          core: ['src/core/FilterSystem.js', 'src/core/FilterConfig.js', 'src/core/FilterLogic.js', 'src/core/FilterUI.js'],
          auth: ['src/modules/auth/AuthService.js', 'src/modules/auth/AuthUtils.js', 'src/modules/auth/MagicLinkService.js'],
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