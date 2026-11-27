# LevelForge — LF-EDITOR-DOCKING-S03-G001-INTEGRAL

**Autorización exacta:** `Listo. LF-EDITOR-DOCKING-S03-G001-INTEGRAL autoriza comenzar`

**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_VIEWPORT_CONTROLS_S02_G001_INTEGRAL_CORR-002_SOURCE_BASELINE.zip`. S01/S02 aprobados por usuario, evidencia S02: 25/25 Node, 30/30 Electron, build Editor 819 módulos y Player 414 módulos, QA visual usuario aprobado.

**Estado de entrega original (histórico):** IMPLEMENTADO; Electron/build no verificados en el entorno de entrega y QA local pendiente. **Estado vigente tras CORR-002: APROBADO y CERRADO por el usuario el 2026-11-03.** Consultar el documento CLOSE y la última evidencia del ledger.

## Implementación

- `src/core/editor/docking.js` gestiona una única preferencia versionada `dockLayout`: árbol por zona, grupo de pestañas, división direccional, floats y ocultos. Contiene validación, migración desde preferencias legadas, ubicación única por panel y restauración.
- `src/components/DockTree.vue` extiende el Editor con pestañas, DnD HTML5, destinos izquierda/derecha/arriba/abajo/centro, divisores con teclado, selección, ocultación y flotante.
- `src/components/DockPanelBank.vue` conserva una instancia de los paneles originales visitados y usa `Teleport` para reubicarla. Proporciona alojamiento oculto cuando una zona se cierra o se maximiza Play.
- `src/components/DockFloating.vue` reutiliza `AppWindow` para posición/redimensión/foco y ofrece redocking; no incorpora una segunda geometría de ventana.
- `src/App.vue` conserva el viewport central fijo y los drawers para móvil; aloja cuatro zonas más floats y protege la ruta central de Shader Graph.
- `BottomDock.vue` e `InspectorDock.vue` aceptan alojamiento por pane sin duplicar la lógica y conservan la ruta antigua para móvil.
- `FloatingEditorWindow.vue` y `AppWindow.vue` se extienden para editores especializados; el propietario de los documentos y la persistencia de proyecto no cambian.
- `Toolbar.vue` permite recuperar paneles ocultos y restaurar layout, conservando comandos y modos existentes.
- Los consumidores de Timeline, Animación y VCS consultan la ubicación activa en lugar de asumir `bottomTab`; se preserva el fallback móvil.
- `window-layout.js` reserva espacio para la zona superior y mantiene restricciones del viewport.
- `state.js` normaliza y persiste `dockLayout` aprovechando el mecanismo existente de preferencias.

## Invariantes

1. Un panel no está simultáneamente en dos grupos ni entre grupo/flotante/oculto.
2. El viewport no es panel registrado; Play/Stop, Escena/Juego, Gizmos S02, SceneTabs y Player no cambian.
3. Docks solo modifican presentación y preferencia del Editor; escenas, assets y formato `.lfproj` no se migran.
4. Restauración del layout es explícita y no elimina datos de proyecto.
5. Preferencias legadas siguen atendiendo rutas de comandos de panel y modo responsive.
6. Editores transaccionales no se convierten en docks.

## Riesgos pendientes de QA local

- Montaje y traslado de `Teleport` al alternar Play maximizado o al cerrar/reabrir zonas.
- Persistencia de todos los editores especializados al cerrarlos/reabrirlos; desplazamiento de foco en ventanas.
- Interacción con Shader Graph central, ventana y grupos en proyectos con documentos reales.
- CSS, DnD y escalado DPI en Electron Linux/Windows.

Las pruebas Node verifican modelo e integraciones estáticas, **no** permiten declarar que estos riesgos ya fueron superados visualmente. El runner Electron comprueba DOM Vue en Electron embebido sin GPU; no sustituye QA de usuario.

## CORR-001 — QA visual de acoplamiento (2026-11-03)

El usuario **NO APROBÓ S03** tras comprobar la implementación: quedó un indicador de destino sobre el viewport y el acoplamiento no era inequívoco como pestañas que comparten el mismo espacio. Node 76/76, Electron 28/28, build Editor 826 módulos y Player 414 módulos PASS documentados por usuario, pero no equivalen a QA visual.

**CA-002** concreta que el encabezado de un dock y el centro de su cuerpo agrupan paneles en pestañas, mientras los bordes estrechos permiten divisiones. Se corrige el ciclo de vida de indicadores DnD en `App.vue` y `DockTree.vue` y se reduce el aviso sobre viewport a una etiqueta compacta. Se añade una función pura de destino en `docking.js`; sin un segundo estado de ubicación ni otro sistema de ventanas. Test Node y fixture Electron reforzados. El Gate permanece abierto hasta nueva aprobación.

## QA S03 CORR-002 (2026-11-03)

La segunda captura de rechazo visual muestra un panel Jerarquía vacío y una división derecha con Inspector vacío, frente a Señales funcionales. CA-003 documenta la corrección de montaje reactivo/hosts `Teleport`, selección explícita de Escena y prioridad de drop en Inspector. La pérdida real de nodos no está evidenciada. Node 88/88 PASS y focal 136/136 PASS; Electron/build CORR-002 NO VERIFICADOS; QA usuario NO APROBADO hasta retest.

## Cierre integral S03 tras CORR-002 — 2026-11-03

El usuario declaró «Aprobado» tras la evidencia local de Node 88/88 PASS, Electron DOM Vue 44/44 PASS y compilación Editor 826 módulos/Player 414 módulos PASS. Se registra **QA LOCAL PASS declarado por el usuario**, **APROBADO** y **CERRADO** en alcance. Se preservan los rechazos S03 original y CORR-001 y las CA-001/002/003. No se hicieron cambios de producción en el cierre.

El runner Electron cubre DOM Vue, no GPU ni pruebas de distribución. AppImage/DEB, `S02-16`, `SCENE-09` y auditoría de dependencias npm quedan pendientes independientes; ninguno bloquea el cierre funcional de S03 según aprobación del usuario. Fuente de evidencia: `docs/qa/evidence/LF-EDITOR-DOCKING-S03-G001-INTEGRAL/user-s03-corr002-approval-2026-11-03.md`.
