# CENTURY-EDITOR-STABILITY-S01-G002-DOCKING-DOM-LIFECYCLE-INTEGRITY

Corrección del ciclo de vida DOM

Base: source_baseline(9).zip, 4228 archivos, CRC válido, SHA256 76db6efc1648631a4714e1cddc518316e4a3608f9a463b8580ab2fbe54b0cbca. Comparación con source_baseline(8).zip: 280 añadidos, 110 modificados, 0 eliminados. No disponible la entrega acumulativa intermedia exacta ni el árbol local externo al ZIP. Se conserva el histórico existente; no se modifica el blockout ni Jolt. Sin dependencias nuevas. Build y Electron bloqueados por ausencia de Vite; npm no pudo acceder al registro. Las pruebas Chromium usan Vue 3.5.13 disponible, no la versión 3.5.43 fijada en el lock. Three.js 0.186.1 y Electron 44.5.1 no instalados. Ningún Gate aprobado ni cerrado.

## Alcance y decisión

Se acredita en Vue real aislado que Teleport puede quedar sin destino durante una actualización que reconstruye el host; también se acredita que el cierre anterior ocurre con el contenido aún dentro de la ventana. Resolver el destino conectado tras nextTick mediante el resolver existente; retirar registro y destino antes de cerrar, esperar el parche Vue y salir del despacho beforeunload antes del cierre definitivo. Conservar una sola instancia y los mecanismos nativos; las ocho excepciones exactas locales insertBefore/style no se han reproducido. Cierre por el gestor de ventanas y todas las transiciones reales siguen pendientes.
