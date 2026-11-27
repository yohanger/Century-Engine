# LF-VFX-INSPECTOR-CA-001 — Edición de recursos `.vfx` desde el Inspector

**VINCULANTE:** aprobada dentro de `LF-VFX-INSPECTOR-S01-G001` mediante autorización exacta `Listo. LF-VFX-INSPECTOR-S01-G001 autoriza comenzar`.

**Contratos parent:** LF-VFX-S00-G001 (recurso compartido), LF-VFX-S01–S03 y LF-ASSETS-SLOT-DND. Se reemplaza exclusivamente el mecanismo de apertura / ventana definido en `LF-VFX-S03-G001` y el doble clic de `VFX-R02`. El resto de garantías de datos, versiones, QA, Player, escenas y referencias permanece vinculante.

## Contrato actual

1. Seleccionar un `.vfx` en Assets, con un clic, muestra el recurso **en el Inspector existente** (`InspectorDock.vue`), conservando `store.projSel` como **única autoridad de selección**. Doble clic o Editar enfoca el mismo recurso, sin crear ventana ni duplicar la definición.
2. El componente existente `VfxEditor.vue` se reutiliza como panel especializado del Inspector. El Editor principal ya no monta una ventana modal VFX. Solo los editores que requieren trabajo independiente, como Script, GLSL o Shader Graph, conservan sus ventanas.
3. `project.vfx` sigue siendo el único documento compartido; `VFX3D` mantiene únicamente la referencia `vfxId`, su estado de instancia y la simulación independiente. Se preservan identidades, nombres, Texturas por ID, validación, curvas, Undo/Redo y los mecanismos originales de guardado y empaquetado.
4. La **vista previa es explícita**; seleccionar o editar no cambia cámara ni esconde el mundo. Solo al pulsar Vista previa se reutilizan el `Viewport`, `VfxSimulation`, `VfxBillboardRenderer` y el ciclo de frames existentes; cerrar, cambiar de recurso/escena, entrar en Play, bloquear Editor o desmontar el Inspector restaura cámara, estado de vista y libera recursos temporales. No hay renderer, escena, RAF ni persistencia paralelos.
5. `movement.tornadoFlow` se conserva **internamente** en los recursos legacy para que S12/S12A y Player no pierdan el contrato existente. **No se presenta como una propiedad de autoría en el Inspector**. La eliminación del dato y su sustitución en World/scripting están **PENDIENTES PLANIFICADAS para S02**, no implementadas aquí. No se modifican motor meteorológico, físicas ni API scripting.
6. Los tests históricos que requerían la ventana VFX o el control de autoría meteorológica quedan adaptados únicamente en los puntos supersedidos; deben conservar su restante cobertura. No se borra la evidencia S03 ni su archivo de implementación anterior.

## Exclusiones

No crear árbol de nodos VFX alternativo, nuevo gestor de previews, segundo Inspector, nueva autoridad de edición, escena de prueba permanente, preset de café, migración de `.vfx`, refactor de ProjectPanel ni cambiar la lógica de tornado hasta S02.

## Estado de cierre

S01 exige pruebas Node, harness Vue/WebGL real, compilación Editor/Player y QA visual del usuario; cualquier dependencia ausente es **NO VERIFICADO**, no PASS. La corrección Jolt WASM sigue abierta e impide certificar toda la integración Player y el S13 climático.
