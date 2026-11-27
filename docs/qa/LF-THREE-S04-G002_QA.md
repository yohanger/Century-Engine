# LF-THREE-S04-G002 — OutlinePass editorial

**Entrada:** `LevelForge_THREE_S04_G001_SOURCE_BASELINE(1).zip` (716 archivos, integridad ZIP PASS). **Autorización:** `Listo. LF-THREE-S04-G002 autoriza comenzar` (2026-10-25). **Estado:** implementado en fuente; QA de WebGL / compilación / Player y aceptación visual pendientes. **Three.js:** `^0.170.0` sin migración.

## Contrato ejecutado

- `OutlinePass` oficial r170 desde `three/addons/postprocessing/OutlinePass.js`, montado exclusivamente en `LookPipeline` / `EffectComposer` existentes. No hay segundo compositor ni un registro independiente de selección.
- `Editor.setSelection()` conserva los mismos IDs, selección múltiple, `BoxHelper` y gizmos. Las preferencias del editor eligen **Caja** (valor anterior y predeterminado), **Contorno** o **Ninguno**. Se utilizan referencias de los nodos reales para `OutlinePass.selectedObjects`; ningún campo se incorpora a la escena o al esquema de proyecto.
- **Preferencias del editor**: color, grosor y fuerza del contorno. Persistencia en las preferencias personales (`levelforge:prefs`) ya existentes; los ajustes se aplican en vivo. La selección principal continúa identificándose por el gizmo existente. `OutlinePass` solo delinea geometría 3D; sprites, líneas y luces sin mallas pueden no generar contorno.
- **Clásico / Perfil Bajo:** sin postprocesado, la ruta de render previa continúa intacta. Únicamente mientras Outline editorial está habilitado con una selección se activa la ruta mínima `RenderPass + OutputPass + OutlinePass`. Esto no activa AO, DOF, SSR ni LUT. Se conserva la selección sin coste adicional si se elige Caja/Ninguno o no hay objetos seleccionados.
- **Realista / Medio-Alto:** la selección utiliza el compositor activo. `OutlinePass` se ejecuta después de los pases de la escena y de gradación, sin sustituir `SSRPass`, niebla, DOF, AO, Bloom ni LUT. En modo dividido se incorpora en el compositor de resolución completa, después de nitidez.
- **Editor/Play/Player:** el pase requiere `!viewport.playing` y al menos una referencia de selección editorial. Play Mode suspende la selección del Editor y el Player nunca la proporciona. El cambio de cámara se sincroniza cada frame. Se usa `setSize()` del compositor, con `dispose()` cuando cambia el modo o cesa la selección. Se conserva el render separado de gizmos/overlay.
- **Otros efectos:** Lensflare permanece inalterado y WaterWorld no cambia. No se crea resaltado de objetos de gameplay en este Gate.

Referencia oficial versionada: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/postprocessing/OutlinePass.js

## QA automatizado en entorno de entrega

```
node --test scripts/test-three-s04-g002.mjs
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)
npm run build
```

- G002: **10 PASS, 0 FAIL, 1 SKIP** (prueba dinámica de Three.js no ejecutable sin dependencias).
- Regresión de suites ejecutables: **818 PASS, 0 FAIL, 13 SKIP**. `test-starcat.mjs` excluido porque importa Three.js sin `node_modules`.
- Comprobación de sintaxis `node --check` en módulos JS modificados y suite: **PASS**.
- `npm run build`: **NO VERIFICADO**, `vite: not found`. No declarar integración GPU, builds de Editor/Player, PSX o exportación como PASS basándose solo en Node.

## Checklist de QA local (usuario)

- [ ] Abrir un proyecto antiguo: selección con Caja igual que antes; no aparece Outline ni se activa su coste.
- [ ] Ir a **Preferencias del editor → Selección de objetos 3D**, activar Contorno, ajustar color, grosor e intensidad y observar aplicación instantánea.
- [ ] Seleccionar una primitiva y varias; las mallas seleccionadas reciben Outline sin BoxHelper adicional y el gizmo sigue funcionando.
- [ ] Probar modo Ninguno y volver a Caja: no se pierde la selección, gizmos ni jerarquía.
- [ ] Borrar, reemplazar, ocultar o duplicar nodos y cambiar de escena: no aparecen selecciones obsoletas ni errores GPU.
- [ ] Entrar en modo edición de malla: Outline de objeto se desactiva. Volver a Object Mode restituye el comportamiento correspondiente.
- [ ] Alternar visual **Clásico**, **Bajo**, **Realista Medio/Alto**, **PSX**, y cámara ortográfica/perspectiva; revisar color, niebla y escala de contorno.
- [ ] Probar SSR, AO, Bloom, LUT, DOF y Lensflare simultáneos, conservando la cadena anterior.
- [ ] Jugar dentro del Editor y exportar Player: no debe verse Outline editorial. Detener Play debe restaurar la selección original.
- [ ] Comparar FPS y memoria con Caja, Contorno y Ninguno; especialmente en Intel UHD 605. El coste debe quedar limitado a Editor con selección.
- [ ] Ejecutar `node --test scripts/test-three-s04-g002.mjs` y `npm run build` en la instalación real con dependencias. Se espera que la suite nueva pueda ejecutar su test dinámico.

**Reconciliación obligatoria:** comparar los archivos existentes en el equipo con el CHANGE ZIP antes de extraer. Conservar el SOURCE_BASELINE completo como respaldo; no sobreescribir modificaciones locales desconocidas. **Entrega exacta:** `LF-THREE-S04-G002_CHANGE.zip` y `LevelForge_THREE_S04_G002_SOURCE_BASELINE.zip`, sin SHA independiente.
