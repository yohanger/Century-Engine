# LF-EDITOR-DOCKING-CA-003 — Montaje de paneles y selección explícita de Escena

**Gate parent autorizado:** `LF-EDITOR-DOCKING-S03-G001-INTEGRAL`. **Motivo:** QA visual local del usuario 2026-11-03 tras CORR-001. **Estado:** corrección implementada, QA LOCAL PENDIENTE, Gate S03 abierto.

## Evidencia observada y distinción de causas

1. **OBSERVADO (captura):** la pestaña Jerarquía se encuentra visible pero el cuerpo aparece vacío; Inspector también aparece sin contenido mientras Señales sí muestra su contenido. La escena sigue dibujándose en el viewport: no existe evidencia de eliminación de nodos o escenas.
2. **INFERENCIA TÉCNICA:** la activación tardía y el cambio de destino de los `Teleport` de `DockPanelBank.vue` pueden dejar paneles sin montar o apuntando a un host sustituido al dividir/mover grupos. El registro aportado no contiene trazas DOM para establecer la causa raíz de ese incidente concreto. El arreglo endurece ambos contratos y la verificación visual sigue siendo obligatoria.
3. **CAUSA CONFIRMADA del Inspector de escena sin selección:** `Inspector.vue` mostraba `ScenePanel` con `v-else-if="!obj"`, independientemente de `store.sceneSel`; la rama posterior de "sin selección" era inalcanzable. `SceneTree.vue` resaltaba implícitamente Escena cuando no había objeto seleccionado. Ambos hechos ya existían antes de S03.
4. **OBSERVADO (feedback):** soltar una pestaña sobre Inspector resulta irregular. Los formularios del Inspector contienen receptores de drop propios. La intercepción en burbujeo del grupo no garantiza prioridad frente a handlers hijos. La captura no demuestra que este fuera el único motivo en todos los intentos.

## Contrato correctivo

- **Jerarquía y paneles:** cada panel se instancia una vez, cuando está activo por primera vez; se conserva al desplazarse entre grupos. El listado de paneles activados reacciona directamente a la actividad del layout; el destino físico se vuelve a resolver después de actualizar el DOM, usando elementos existentes o un host oculto seguro. No se duplican paneles ni estados.
- **Escena en Inspector:** mostrar `ScenePanel` únicamente cuando `store.sceneSel` está activo por `selectScene()`. Sin nodo ni escena seleccionados, mostrar el estado vacío existente. Seleccionar un nodo o limpiar selección desactiva el contexto de escena. La raíz Escena no se resalta por mera ausencia de nodos seleccionados.
- **Drop en Inspector:** capturar los eventos de arrastre únicamente cuando el MIME es `application/x-lf-dock-panel`, antes de los receptores anidados. Una suelta en la barra de pestañas siempre se interpreta como compartir el mismo grupo; las divisiones continúan reservadas al borde del cuerpo. Los drops de Assets/recursos no deben consumirse por el docking.
- Se conservan CA-001/CA-002, viewport fijo, Editor/Player, persistencia de escena y layout, Signals, Edit Mesh, selección múltiple, Shader Graph y ventanas existentes. Ningún cambio de esquema de proyecto.

## Evidencia para cierre

- Node S03/WL y regresión S01/S02/Shader Graph PASS.
- Fixture Electron embebido con arrastre hacia un receptor anidado de Inspector; y QA manual de Jerarquía/Inspector con proyecto real.
- Build Editor y Player, sin tomar la compilación como equivalente a QA visual.
- Solo el usuario puede aprobar S03 después del retest. Conservar el rechazo y los PASS anteriores como eventos históricos separados.
