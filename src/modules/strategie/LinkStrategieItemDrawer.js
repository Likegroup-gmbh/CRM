// Stub: LinkStrategieItemDrawer wurde in einem fruehen Commit (7aeed78) als
// Import referenziert, das eigentliche Drawer-Modul ist jedoch nie ins Repo
// eingecheckt worden. Damit der Vite-Build nicht bricht und der "Strategie
// verlinken"-Button kein Crash ausloest, stellen wir hier einen No-Op-Stub
// bereit, der dem User ein klares Feedback gibt. Sobald das richtige Modul
// nachgereicht wird, kann diese Datei ersatzlos geloescht werden.

export class LinkStrategieItemDrawer {
  async open(_options = {}) {
    const msg = 'Strategie-Verlinken-Drawer ist noch nicht deployed.';
    console.warn('[LinkStrategieItemDrawer:stub]', msg, _options);
    if (window.toastSystem?.show) {
      window.toastSystem.show(msg, 'warning');
    } else {
      alert(msg);
    }
  }

  close() {}
  destroy() {}
}

export default LinkStrategieItemDrawer;
