# LF-VCS-S02-G001 — QA y criterios de cierre

**Fecha:** 2026-10-29. **Estado:** implementado, pendiente de QA local y aprobación final.

| ID | Criterio | Evidencia |
|---|---|---|
| VCS-02-01 | Inspeccionar commits con SHA completo | Tests S02, Git embebido real Linux: PASS |
| VCS-02-02 | Enumerar archivos de un commit, incluido commit raíz | Test `detail` en Git embebido: PASS |
| VCS-02-03 | Comparar dos revisiones por hash | Test `compare` real: PASS |
| VCS-02-04 | Comparar una revisión con WORKTREE, incluidos nuevos sin seguimiento | Test real: PASS |
| VCS-02-05 | Diff textual seguro y Unicode/rutas con espacios | Test real: PASS |
| VCS-02-06 | Detectar renombres y origen/destino correctamente | Test Git real: PASS |
| VCS-02-07 | No representar bytes de archivos binarios como texto | Test binario real: PASS |
| VCS-02-08 | `.lfproj` como binario (sin diff semántico) | Diseño del backend: SIN QA visual |
| VCS-02-09 | Commit selectivo sin arrastrar staging previo ajeno | Test real con staging anterior: PASS |
| VCS-02-10 | Límites en salida/rutas/revisiones y paginación | Tests de validación y paginado: PASS parcial |
| VCS-02-11 | Sin checkout/reset ni comandos Git arbitrarios | Test de IPC: PASS |
| VCS-02-12 | Compatibilidad proyectos, nodos y Undo/Redo | Sin cambio de motor; QA Electron pendiente |
| VCS-02-13 | UI a 1440×900, 1280×720 y 1024×768 | PENDIENTE Electron |
| VCS-02-14 | Editor y Player compilan | PENDIENTE: `vite: not found` |
| VCS-02-15 | Git embebido en Linux AppImage/DEB y MinGit Windows | PENDIENTE distribución real |

## Comandos

```bash
npm ci
npm run vcs:test
npm run test:distribution
npm run build
npm run electron
```

QA local sugerido: crear un repositorio en un proyecto guardado; registrar dos revisiones de un script, una imagen y `project.lfproj`; abrir **Versiones > Historial**; inspeccionar un commit y elegir revisiones A/B; comprobar diff de script y aviso binario; seleccionar la carpeta actual y contrastar cambios de disco; abrir repositorio con archivo preparado previamente ajeno a la selección, crear commit desde LevelForge y verificar que ese archivo **no se incluye**. Comprobar las tres resoluciones y Linux/Windows sin Git en PATH.

**Resultado automatizado actual:** 86 PASS, 0 FAIL, 0 SKIP (Git S01+S02, Road Paint, Shift+A y distribución). La compilación Vite no se ejecutó porque no hay `node_modules` instalado; no equivale a un PASS.
