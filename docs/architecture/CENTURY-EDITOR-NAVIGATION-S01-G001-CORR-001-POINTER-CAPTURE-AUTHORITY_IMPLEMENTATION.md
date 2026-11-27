# CENTURY-EDITOR-NAVIGATION-S01-G001-CORR-001-POINTER-CAPTURE-AUTHORITY

Corrección parcial de autoridad del puntero

Base: source_baseline(9).zip, 4228 archivos, CRC válido, SHA256 76db6efc1648631a4714e1cddc518316e4a3608f9a463b8580ab2fbe54b0cbca. Comparación con source_baseline(8).zip: 280 añadidos, 110 modificados, 0 eliminados. No disponible la entrega acumulativa intermedia exacta ni el árbol local externo al ZIP. Se conserva el histórico existente; no se modifica el blockout ni Jolt. Sin dependencias nuevas. Build y Electron bloqueados por ausencia de Vite; npm no pudo acceder al registro. Las pruebas Chromium usan Vue 3.5.13 disponible, no la versión 3.5.43 fijada en el lock. Three.js 0.186.1 y Electron 44.5.1 no instalados. Ningún Gate aprobado ni cerrado.

## Alcance y decisión

En Chromium, dos listeners sobre el mismo canvas reproducen InvalidStateError cuando el primero solicita Pointer Lock y el segundo intenta capturar. El stack minificado local qe.pn no puede mapearse porque el bundle exacto y su mapa no están en la base. Se instala un guard en fase de captura antes de OrbitControls, limitado al editor; el gesto continuo aceptado consume el evento antes de listeners posteriores. Se mantiene el mecanismo ContinuousGrab y la ruta de vuelo existente. No se acredita que el origen exacto de las 262 excepciones sea ese controlador. No se altera la ruta Player.
