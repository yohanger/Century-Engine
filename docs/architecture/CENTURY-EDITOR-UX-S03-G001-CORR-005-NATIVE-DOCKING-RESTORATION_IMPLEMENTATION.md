# Restauración de destinos y arrastre de ventanas nativas

Gate autorizado conforme a CA-004. Estado: implementación en fuentes, pendiente de QA integrado y aprobación. Baseline de entrada: 4.343 archivos, CRC correcto, SHA-256 `b7b5ca8c7b0128606f4d5b5f295cc29139d597a1f3cc6c39bb77646ddfe4eeca`. Cambios locales del usuario no accesibles.

## Responsabilidad y mecanismo

- `native-dock.js`: conserva umbrales e impide separar sobre destino válido.
- `dock-gesture.js`: el gesto existente utiliza el documento propietario, comprueba captura antes de iniciar, resuelve destino mediante hit-test del documento principal, valida grupo y restricciones de vistas obligatorias, informa la vista previa y confirma al soltar. Después de materializar una ventana, el mismo gesto puede volver a un grupo. Escape restaura el layout inicial en una salida desde el editor o la posición inicial al mover una ventana previa. `pointercancel`, `lostpointercapture`, pérdida de foco, página retirada o botón perdido limpian la captura y los listeners; no se recaptura automáticamente.
- `docking.js`: inserción/reordenación de pestañas sin duplicar paneles, división y persistencia con coordenadas de pantalla negativas. Las vistas obligatorias mantienen su restricción al centro o flotante.
- `DockTree.vue`: reaprovecha la vista previa de bordes y pestañas; el título de `AppWindow.vue` y `FloatingEditorWindow.vue` acoplables inicia el mismo gesto y queda fuera de `app-region: drag`. El resto de la barra nativa permite arrastrar la ventana. No se cambia paleta ni distribución.
- El regreso de recursos conserva la ubicación confirmada; `restoreDockPanel()` solo recupera un panel sin destino acoplado. Los consumidores siguen usando Teleport y el mecanismo de cierre diferido; no se crean nuevas instancias del motor. Code conserva su contrato previo de pestaña obligatoria y retorno al reiniciar.
- `electron/main.cjs`: recupera un título fuera del área útil cuando abre una ventana sin gesto activo, acepta monitores con origen negativo, conserva el IPC existente. No se fuerza el reposicionamiento durante el arrastre activo.
- Las pruebas históricas incompatibles se ajustan a CA-004 (umbral, retorno en mismo gesto y título propietario en lugar de HTML Drag and Drop para Code nativo). Se mantienen el contrato de recurso único, límites de IPC, y pruebas de liberación.

## Límites

Las pruebas Node utilizan modelos/DOM simulado e IPC simulado; no certifican arrastre físico entre ventanas. La conversión de pantalla usa las coordenadas lógicas del documento principal y del popup; queda por acreditar con zoom/DPI y varios monitores reales. La plataforma puede impedir `setPosition` o cancelar el gesto. Se preserva la ventana ante cancelación por compositor. La restauración transaccional ante fallo de creación/transferencia nativa y la persistencia de cambios de tamaño/posición hechos por el gestor del sistema no están acreditadas integralmente. Los diálogos no acoplables se conservan.

## QA

- Focal nueva: 1/11 antes, 11/11 después. Suite combinada 28/28. Regresión histórica 82/86 antes y después (cuatro expectativas antiguas no relacionadas, preservadas). Ratón 70/70, Edit Mesh 9/9, iconografía 11/11.
- Runner `native-docking-restoration-electron`: usa proceso principal de Century, perfil temporal, IPC productivo, BrowserWindow y entradas CDP. Bloqueado por falta de Vite antes de iniciar. No acredita éxito, ni sustituye QA manual con ratón físico X11/XWayland/Wayland.
- Build bloqueado por falta de Vite. No se han alterado runtime, físicas, renderizado, recursos de juego ni Git.
