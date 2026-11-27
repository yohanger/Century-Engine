# QA — CENTURY-EDITOR-INSPECTOR-S01-G001-CORR-002-NUMERIC-FOCUS-PRECISION

Base: source_baseline(9).zip, 4228 archivos, CRC válido, SHA256 76db6efc1648631a4714e1cddc518316e4a3608f9a463b8580ab2fbe54b0cbca. Comparación con source_baseline(8).zip: 280 añadidos, 110 modificados, 0 eliminados. No disponible la entrega acumulativa intermedia exacta ni el árbol local externo al ZIP. Se conserva el histórico existente; no se modifica el blockout ni Jolt. Sin dependencias nuevas. Build y Electron bloqueados por ausencia de Vite; npm no pudo acceder al registro. Las pruebas Chromium usan Vue 3.5.13 disponible, no la versión 3.5.43 fijada en el lock. Three.js 0.186.1 y Electron 44.5.1 no instalados. Ningún Gate aprobado ni cerrado.

## Evidencia

49/49 antes y después. Chromium aislado PASS. 14 comprobaciones Electron previstas, 0 ejecutadas. Causa exacta y corrección productiva pendientes; no declarar defecto del fixture hasta obtener evidencia.

## Repetición local

```bash
npm run test:suite -- numeric-display-precision
npm run test:suite -- numeric-display-precision-electron
```

No se acredita Electron, compilación ni aprobación. Los scripts Python de evidencia documentan la reproducción en el entorno de auditoría; rutas absolutas de ese entorno.
