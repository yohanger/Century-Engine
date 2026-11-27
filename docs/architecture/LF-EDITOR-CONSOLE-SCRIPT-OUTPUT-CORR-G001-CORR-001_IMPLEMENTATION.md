# LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001 — Implementación

## OBSERVADO y causa raíz

La evidencia del usuario demuestra Node 30/30 PASS y compilación Editor/Player satisfactoria en G001. Electron sí arrancó en su equipo: WebGL2 y la carga WASM de Jolt pasaron, junto con otras 11 comprobaciones. Falló «Dos scripts de nodo, dos salidas»; el resto no se ejecutó. El usuario declaró «Aprobado. Aunque los test fallaron.», reconocido como aprobación funcional con incidencia automatizada abierta.

La fixture guardaba un objeto raw en `_lfNodeOwner` y luego entregaba `store.project` reactivo a NodeLifecycle. El guard del runtime compara esa propiedad con el objeto obtenido del proyecto, que es un proxy distinto. Al llamar define_signal/expose durante la evaluación de los dos scripts, los slots se rechazaban como inactivos y no se entregaban las dos salidas _ready. La reproducción Node confirma cero mensajes y dos errores con el propietario raw; con el propietario del proyecto aparecen ambas salidas y no hay errores.

## Intervención de QA

- La fixture existente obtiene `mountedObject` desde `store.project.objects[0]` y usa esa misma identidad como propietario de su Group.
- Se añaden dos comprobaciones: identidad de propietario y ausencia de diagnósticos de montaje de scripts. Las 33 comprobaciones originales permanecen intactas y se conservan sus expectativas.
- La suite Electron mantiene el runner existente y aumenta el mínimo de 30 a 35 comprobaciones, que corresponde a la fixture actual completa. No se ocultan errores ni se reduce cobertura.
- El helper Node existente admite proyecto reactivo y propietario canónico/raw. Las 30 pruebas anteriores permanecen; tres regresiones adicionales comprueban el defecto, su corrección y la cobertura de la fixture.

No se modifica ningún archivo de producción, el guard de identidad, NodeLifecycle, el registro de nodos, Signals, Jolt ni el mecanismo de salida de Consola. Se conserva la base acumulada de 1.665 archivos y el historial de evidencia anterior.

## Resultado y límites

Suite específica: 33 PASS. Regresión focal: 319 PASS. Sintaxis del módulo de la fixture y documentación: PASS. Electron se intentó en este entorno y se detuvo antes de ejecutar la fixture por falta de X/$DISPLAY. Eso no verifica las 35 comprobaciones del navegador embebido. No se declara PASS Electron ni cierre técnico.

Las compilaciones de producción G001 constan en la evidencia local del usuario y no se repiten en esta corrección, ya que src y dependencias son idénticos. La regresión ampliada histórica anterior conserva sus 11 fallos conocidos; no se repara ni se vuelve a declarar PASS global.

Las seis hojas del ledger separan aprobación funcional de G001, fallo local CON-E01, implementación de CORR-001 y QA Electron pendiente. El usuario solo necesita verificar esta corrección, sin repetir su QA funcional ya aprobado. Si las comprobaciones restantes revelan un fallo de producción, esa intervención requiere declarar y autorizar su alcance antes de cambiar código.
