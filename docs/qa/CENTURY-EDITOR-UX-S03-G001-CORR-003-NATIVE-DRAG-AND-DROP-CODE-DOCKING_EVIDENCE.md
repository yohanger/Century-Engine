# CORR-003 — Evidencia de Code docking por arrastre

**SOURCE_BASELINE:** CORR-002, ZIP original sin cambios Git detectables en su contenido. **Estado:** implementado en fuente; no compilado; QA Electron/multimonitor no verificado; no aprobado ni cerrado.

| Prueba | Resultado | Evidencia |
|---|---|---|
| Suite focal y compatibilidad | 30/30 PASS | `_FOCUSED.log` |
| Regresión selectiva ampliada | 151/160 PASS, 9 FAIL | `_REGRESSION.log` |
| La misma regresión en CORR-002 anterior | 138/147 PASS, 9 FAIL | `_BASELINE_REGRESSION.log` |
| Sintaxis `script setup` de tres componentes | 3/3 PASS | `_SYNTAX.log` |
| `npm run build` | EXIT 127, `vite: not found` | `_BUILD.log` |
| Electron real: arrastre externo, arrastre de regreso, multimonitor | NO VERIFICADO | Sin entorno de ejecución acreditado |

**Nueve fallos compartidos:** `DOCK-30`, `DOCK-C09`, `WL-12` y seis casos `SE-C03`. No se detectan casos fallidos adicionales en el conjunto comparado.

**Pruebas locales pendientes:** (a) arrastrar la pestaña Code o su acceso de la barra superior fuera del editor y confirmar ventana Electron no modal; (b) moverla entre monitores; (c) arrastrar el título Code desde la ventana al centro o borde del docking y confirmar reacoplamiento; (d) guardar, deshacer/rehacer, cambiar scripts; (e) cerrar la ventana externa y recuperar Code; (f) mantener Play en ejecución; (g) minimizar/maximizar ventanas; (h) comprobar que no aparece un botón explícito de desacoplar en Code. No declarar el Gate aprobado hasta disponer de estos resultados.
