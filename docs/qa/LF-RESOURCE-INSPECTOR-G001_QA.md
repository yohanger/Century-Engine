# LF-RESOURCE-INSPECTOR-G001 — QA y alcance

**Estado:** APROBADO POR EL USUARIO · TEST AUTOMATIZADO PASS · QA LOCAL NO VERIFICADO.

## Contrato ejecutado

El recurso `.post` (incluido el legado `.profile`) se edita **en el Inspector derecho**, no en una ventana propia. La selección de Assets usa `store.projSel`, mientras que la selección de escena continúa en `store.selectedId`. La edición de Perfil fue el alcance exclusivo de G001; G002 incorporó posteriormente Material y GameManager al mismo Inspector; no se altera la jerarquía, el compositor ni el formato del proyecto. Los accesos «Editar…» desde Cámara/Spawn y GameManager llegan al mismo Inspector; al venir de GameManager se selecciona el perfil en el mismo Inspector (G002), sin abrir ni cerrar ventanas flotantes.

`ProfileEditor.vue` contiene los controles existentes (`PROFILE_EFFECTS`, `ParamForm`, Shader Graph). El render Antes/Después continúa siendo la escena del Editor a través de `previewProfile()`; cambiar de perfil, de pestaña o de selección desmonta el contenido y restaura el render normal. La previsualización es temporal, no una modificación del perfil ni del render del proyecto.

**Cambios autorizados:** `src/components/{InspectorDock,ProfileEditor,ProjectPanel}.vue`, `src/App.vue`, `src/core/state/{profiles,objects,state}.js`, este informe, tests G001 y ledger. No se altera el sistema de postprocesado.

## Pruebas automatizadas ejecutadas

- Suite específica: `node --test scripts/test-resource-inspector-g001.mjs` → **18 PASS, 0 FAIL**.
- Regresión Node disponible: **1661 PASS, 0 FAIL, 18 SKIP** (79 archivos de pruebas, incluidos los 18 nuevos).
- `scripts/test-starcat.mjs` no se ejecutó en esta regresión: falta `three` en el entorno. Exclusión adicional a los 18 SKIP.
- `npm run build`: **NO VERIFICADO**; salida `vite: not found` (código 127).
- Editor Electron, edición visual, Player, GPU y guardado real de disco: **NO VERIFICADOS**.

Las pruebas estructurales comprueban rutas de selección y ciclo de vida declarados en el código y el modelo real de los perfiles; **no equivalen a ejecutar componentes Vue en Electron**.

## QA local del usuario

En una copia aislada del SOURCE_BASELINE, desde la raíz del proyecto:

```bash
npm ci
node --test scripts/test-resource-inspector-g001.mjs
npm run build
npm run electron
```

Resultado esperado de la suite específica: **18 PASS y 0 FAIL**. Build y Electron deben verificarse en tu equipo.

- [ ] Seleccionar un `.post` en Assets con **un solo clic**: se abre el Inspector y ninguna ventana flotante.
- [ ] Modificar nombre, activar un efecto, ajustar sus parámetros y guardar/reabrir el proyecto: persisten los cambios.
- [ ] Pulsar **Ver antes (sin perfil)** y **Mostrar después**: se usa el mismo viewport, sin crear cámaras.
- [ ] Cambiar de `.post` a otro recurso o a la pestaña Terreno: el render se restaura; al volver a `.post`, se previsualiza el perfil seleccionado.
- [ ] Seleccionar un objeto de la jerarquía: el Inspector vuelve al objeto sin alterar su selección persistida ni el gizmo.
- [ ] En Cámara o Spawn, «Editar…» y «Nuevo…» abren el recurso en el Inspector.
- [ ] En GameManager, «Editar perfil…» y «Nuevo .post…» no dejan el Inspector bloqueado detrás de la ventana.
- [ ] Para un perfil con Shader Graph de postprocesado, el selector y «Abrir Shader Graph…» siguen funcionando.
- [ ] Abrir un `.profile` antiguo: conserva extensión y efectos, incluso tras renombrar.
- [ ] En dock de aproximadamente 296 px, sliders, selectores y listas siguen siendo utilizables y desplazables.

Si falla una prueba, remitir pasos, captura/vídeo y log. No se marca QA LOCAL PASS sin evidencia. G002 (Material/GameManager en Inspector) y Shader Graph UX profesional permanecen **fuera de este Gate**.

## Continuidad aprobada

G001 recibió aprobación expresa del usuario el 27 de octubre de 2026. G002 reutiliza el mismo mecanismo `projSel` para materiales y GameManager. El QA local de G001 permanece NO VERIFICADO; la aprobación no se registra como ejecución de Electron.
