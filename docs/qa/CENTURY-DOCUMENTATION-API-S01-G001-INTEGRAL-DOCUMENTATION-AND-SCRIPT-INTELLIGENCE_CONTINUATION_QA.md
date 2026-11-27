# QA de continuación editorial

Estado: implementación editorial y JSDoc parcial; no aprobado ni cerrado. Baseline de 4.189 archivos con CRC correcto. SHA-256: `25c3127f9c18afda98c6012ca232077efa2e8fbec7e6a6ddbed799e416fac083`. No se dispone del delta local posterior a la aplicación del ZIP.

## Evidencia

- 214 → 213 páginas: dos fuentes excluidas de publicación, una nueva página de clima. 62 interfaces de referencia, 73 comandos, 37 nodos. Inventario por página y fuente en `editorial-inventory.json`.
- 175 miembros reciben JSDoc; 157 aún sin comentario propio. 749 miembros; no se modifica ninguna firma. Tipos TypeScript 5.8.3 validados, copia pública de extensión idéntica.
- `docs:build` PASS condicionado: Marked 4.0.19 disponible, no la versión fijada 12.0.2. `docs:check` 13/13 y `documentation-api` 27/27. La prueba de portal comprueba enlaces y exclusión de páginas técnicas. Dos pruebas históricas de documentación Git se ajustan al alcance editorial ratificado: verificación de seguridad pública preservada, evidencia técnica exigida en archivo interno.
- Regresión ampliada VS Code e IntelliSense: antes 78/87, después 78/87, mismos nueve fallos (dependencias, CLI y runners asociados). No se acredita PASS integral.
- `documentation-api-electron`: bloqueado por Vite; `vscode:prepare`: bloqueado por JSZip. VSIX distribuido 0.1.12 y fuentes 0.1.13, sin modificación del binario histórico.
- Navegación visual Chromium: entorno rechaza apertura por política (ERR_BLOCKED_BY_ADMINISTRATOR); no hay captura válida. Pruebas estáticas de enlaces y navegación PASS, no sustituyen QA visual.
- Pendientes: cobertura completa JSDoc, auditoría Play, discrepancias Game/Player/Input, validación de extensión, compilación, portal regenerado con dependencias fijadas, QA local y aprobación.

Sin cambios en runtime, estilos del portal, escenas ni recursos. Las fuentes antiguas se preservan en el archivo editorial y/o ubicación original.
