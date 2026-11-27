# LF-PERFORMANCE-S17-CA-002-OPTIN-EXPORT-DIAGNOSTICS

**Estado: RATIFICADO por el usuario — 2026-11-12.** No confundir ratificación del contrato con QA local.

## Contradicción resuelta
El contrato F12 anterior prohibía incondicionalmente DevTools en el Player AppImage. El usuario ratificó la excepción exclusiva **por exportación** para diagnóstico. La política de seguridad de producción normal se mantiene sin cambios.

## Cláusulas vinculantes
- **DG-SEC-01:** Build normal: `devTools: false`; Stats deshabilitado, sin comando accesible ni menú. Sin overrides mediante variables de entorno ni indicadores de línea de comandos.
- **DG-SEC-02:** En Build, dos selecciones independientes, estrictamente opt-in: `NGME-DEVTOOLS` y `NGME-STATS`. Se restablecen desactivadas al volver a abrir Build y no se persisten en Database, game.rtpkg ni la autoría del proyecto.
- **DG-SEC-03:** La opción se materializa únicamente en el `config.json` dentro de ESA exportación AppImage. La build normal carece incluso del bloque `diagnostics`.
- **DG-SEC-04:** `Ctrl+Shift+F12` alterna DevTools y `Ctrl+Shift+F3` alterna el monitor únicamente si el artefacto habilita esa capacidad. F12 simple y Ctrl+Shift+I no son atajos de diagnóstico soportados en el juego exportado.
- **DG-SEC-05:** Se preservan `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, permisos mínimos, navegación denegada y restricciones de red. `devtools://` es permitido solo dentro de un AppImage de diagnóstico con DevTools habilitado; sigue denegado en una versión normal.
- **DG-SEC-06:** Stats utiliza el mismo `PerfMonitor` y el mismo componente gráfico del Editor. No se crea un segundo profiler ni un sistema de eventos global.
- **DG-SEC-07:** Los flags no constituyen seguridad criptográfica. El propietario del equipo puede extraer/modificar o inspeccionar su propio ejecutable; la protección controla las funciones ofrecidas por el producto, no garantiza resistencia absoluta a ingeniería inversa.

## Precedencia
Esta CA sustituye únicamente la prohibición absoluta de DevTools en AppImage en el contrato F12. Las restricciones de seguridad del resto de la aplicación permanecen vigentes.
