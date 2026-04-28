import { permissionSystem } from '../core/PermissionSystem.js';

let _currentUser = null;
Object.defineProperty(window, 'currentUser', {
  get() { return _currentUser; },
  set(value) {
    _currentUser = value;
    if (value && value.rolle) {
      permissionSystem.setUserPermissions(value);
    } else {
      permissionSystem.clearPermissions();
    }
  },
  configurable: true,
});
