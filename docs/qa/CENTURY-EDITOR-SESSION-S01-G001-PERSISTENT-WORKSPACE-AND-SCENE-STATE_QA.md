# QA del espacio de trabajo editorial

- Baseline: 4.002 archivos del ZIP de corrección de estabilidad; comparación byte a byte con la copia disponible sin diferencias. Sin acceso al árbol de trabajo del usuario.
- Focal: 12/12 PASS. Pruebas aisladas de almacenamiento y normalización y comprobaciones de conexión en fuentes; no equivalen a ejecución del componente Vue o reapertura de proceso.
- Regresión: 114/135 PASS antes y después; los mismos 21 nombres de fallos. Runner compartido: 10/10 antes y después. Total histórico 124/145 PASS. Se adaptaron inyecciones de helpers en harnesses existentes, sin debilitar las assertions.
- Sintaxis: 30/30 módulos o scripts extraídos PASS; no equivale a compilación SFC.
- Compilación y runner Electron: bloqueados antes de iniciar por falta de Vite. Runner de dos procesos con perfil temporal compartido y mismo origen, 10 comprobaciones de escritura y 17 de reapertura programadas; 0 ejecutadas. La comprobación de scroll verifica estado, no desplazamiento DOM. Validación manual necesaria del scroll visible, ventana real y recuperación tras cierre inesperado.
- Ledger: seis hojas; todos los valores y fórmulas históricos verificados sin diferencias. No aprobado ni cerrado.

## QA local
Aplicar únicamente CHANGE ZIP sobre la última entrega acumulativa. Ejecutar:

```
npm run test:suite -- editor-workspace-session
npm run test:suite -- editor-workspace-session-electron
npm run build
```

Abrir un proyecto real, desactivar Grid y ayudas, modificar cámara y proyección, seleccionar un nodo y plegar grupos. Cambiar Snap y gizmo, abrir/cerrar pestañas. Cerrar y reabrir el editor y el mismo proyecto: restaurar el contexto sin marcar el nivel como modificado. Repetir con dos escenas y dos proyectos; comprobar que Play y Modo Local no sustituyen el contexto normal. Verificar nodos eliminados, scroll real y recuperación tras cierre abrupto usando una copia de prueba. Conservar la salida íntegra del runner y cualquier excepción.
