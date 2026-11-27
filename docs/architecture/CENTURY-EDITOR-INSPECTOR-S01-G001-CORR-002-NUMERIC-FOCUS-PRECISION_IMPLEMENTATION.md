# CENTURY-EDITOR-INSPECTOR-S01-G001-CORR-002-NUMERIC-FOCUS-PRECISION

Diagnóstico del foco numérico; no corregido en producción

Base: source_baseline(9).zip, 4228 archivos, CRC válido, SHA256 76db6efc1648631a4714e1cddc518316e4a3608f9a463b8580ab2fbe54b0cbca. Comparación con source_baseline(8).zip: 280 añadidos, 110 modificados, 0 eliminados. No disponible la entrega acumulativa intermedia exacta ni el árbol local externo al ZIP. Se conserva el histórico existente; no se modifica el blockout ni Jolt. Sin dependencias nuevas. Build y Electron bloqueados por ausencia de Vite; npm no pudo acceder al registro. Las pruebas Chromium usan Vue 3.5.13 disponible, no la versión 3.5.43 fijada en el lock. Three.js 0.186.1 y Electron 44.5.1 no instalados. Ningún Gate aprobado ni cerrado.

## Alcance y decisión

El usuario acredita 49/49 Node y fallo Electron en Foco muestra valor completo. NumberField aislado con Vue real 3.5.13 muestra -7.383456789 al enfocar, conserva el modelo sin commit al salir y guarda -1.23456789 al editar; esto no acredita el Inspector real ni el defecto del fixture. No se modifica NumberField, Vec3Field ni la lógica numérica productiva. El fixture conserva las 13 comprobaciones, usa ratón nativo para el primer foco y añade una comprobación de entrada confiable; registra modelo, valor, rectángulo, estado del documento y foco. Ventana visible/enfocada opt-in en runner, sin cambiar otros runners por defecto.
