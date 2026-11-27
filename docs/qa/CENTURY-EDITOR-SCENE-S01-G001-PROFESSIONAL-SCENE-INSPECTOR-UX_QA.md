# QA — Inspector profesional de Escena

| Verificación | Resultado |
|---|---|
| Integridad del baseline | 3932 archivos, sin diferencias |
| Pruebas focales Node | 12/12 PASS |
| Regresiones antes y después | 65/69 PASS; mismos 4 FAIL |
| Sintaxis JS de fuentes y fixture | PASS |
| Compilación Editor/Player | BLOQUEADA: Vite no instalado |
| Runner Electron | BLOQUEADO antes de iniciar: Vite no instalado |
| Comprobaciones Electron | 19 preparadas; 0 ejecutadas |
| Validación visual, responsividad, cambio de escena y Undo/Redo integrado | NO VERIFICADOS |

Fallos históricos conservados: SCUX-04 (recuento histórico de secciones), S02-16 (expresión literal de persistencia), SCENE-05 (contrato histórico de cuadrícula), SCENE-09 (contrato histórico de Snap). Las tres verificaciones de markup adaptadas a los iconos y al nuevo identificador mantienen su objetivo semántico.

La prueba focal acredita lógica de filtrado y correspondencia de código, no compilación de templates Vue ni funcionamiento visual real.

## Comandos locales

- `npm run test:suite -- scene-inspector-professional-ux`
- `npm run test:suite -- scene-inspector-professional-ux-electron`
- `npm run build`

Comprobar además selección de distintas escenas, controles condicionales, guardado y Undo/Redo, pliegues, búsqueda y anchura del dock. No se ha recibido aprobación de este Gate; no se declara cerrado.
