# Evidencia QA

- Baseline: 3972 archivos idénticos a la copia de trabajo disponible.
- `npm run test:suite -- editor-numeric-pointer-integrity`: 10/10 PASS. Reproduce rechazo de captura mediante excepción simulada, restricciones de dimensiones, desbordamiento UV, serialización no finita, validación numérica y límite de preferencias.
- Regresión comparada: 209/230 PASS en baseline y tras corrección; mismos 21 fallos por nombre. Los logs corresponden a la ejecución anterior a los dos ajustes finales de protección de colocación sin punto y aviso UV; focal y sintaxis se repitieron después. No se afirma un pase integral del proyecto.
- Sintaxis Node de módulos y bloques script: PASS. No acredita compilación Vue.
- `npm run build`: bloqueado, Vite ausente.
- `npm run test:suite -- editor-numeric-pointer-integrity-electron`: bloqueado por preflight de Vite, 0/10 comprobaciones ejecutadas.
- No acreditados: crash original, render real, interacciones nativas, rendimiento, guardado/reapertura con proyecto afectado. Sin aprobación ni cierre.

## QA local
Aplicar CHANGE ZIP sobre la base correspondiente, conservar copia del proyecto y ejecutar ambas suites, además de la compilación. Repetir interacciones con gizmos, Edit Mesh, UV, docking y pérdida de foco, y guardar/reabrir una copia de prueba. Si reaparece el fallo, recoger consola completa y operaciones inmediatamente anteriores, junto con cualquier informe de terminación del proceso.
