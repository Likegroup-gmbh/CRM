import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test-Umgebung für DOM-Tests
    environment: 'jsdom',
    
    // Test-Dateien Muster
    include: ['src/__tests__/**/*.test.js'],
    
    // Globales Setup: registriert PermissionSystem window-exports
    // und synct window.currentUser automatisch mit permissionSystem
    setupFiles: ['src/__tests__/setup.js'],
    
    // Globale APIs (describe, it, expect, etc.) ohne Import
    globals: true,
    
    // Coverage-Konfiguration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/auth/**']
    }
  }
});
