# LF-INSPECTOR-PRIMITIVES-UX-S01-G001 — QA

## Estado

IMPLEMENTADO · 24/24 TEST NUEVO NODE PASS · REGRESIÓN AMPLIADA 228 PASS / 2 FAIL PREEXISTENTES · Electron NO VERIFICADO · Build NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

## Instalación y comandos (Linux)

Extraer `LevelForge_INSPECTOR_PRIMITIVES_UX_S01_G001_SOURCE_BASELINE.zip` en carpeta nueva fuera de proyectos locales existentes; alternativamente superponer CHANGE exclusivamente sobre copia del baseline S00. No sobrescribir Assets, escenas ni `the_room` del usuario.

Desde raíz del nuevo proyecto:

```bash
npm ci
node --test scripts/test-inspector-primitives-ux-s01-g001.mjs
node --test scripts/test-material-ux-s01-g001.mjs scripts/test-transform-uniform-scale-s04-g001.mjs
node --test scripts/test-inspector-primitives-ux-electron-s01-g001.mjs
npm run build
npm run electron
```

## QA Electron y manual (usuario)

1. Crear Cubo (primitiva); verificar que nombre, checkbox visible, lock, tipo, ruta, Tag/Layer y DontDestroyOnLoad permanecen editables.
2. Confirmar que bloques comienzan/terminan de forma clara: Transformación, Cortes, Script, Prefab, Materiales, Iluminación, Malla; en Escalera se muestra su panel específico.
3. Mover, rotar y cambiar Tamaño XYZ y factor `Escala ×`; hacer Undo/Redo y comprobar que no hay cambios de semántica.
4. Hornear cortes, marcar Recibe cortes, abrir Edit Mesh y salir con Tab. No cambiar la geometría ni la selección por acceder al Inspector.
5. Asignar material local, crear recurso compartido, editarlo, hacer local; probar Albedo, rugosidad, metálico, shader y detalle de superficie.
6. Agregar script y quitarlo; crear Prefab, aplicar/revertir/desvincular. El plegado mantiene preferencias al cambiar entre Cubo/Esfera/Cilindro/Plano/Escalera.
7. Reducir Inspector a 260px y ventana a 1024×600, y comprobar ausencia de scroll horizontal/cortes; repetir a 1366×768.
8. Seleccionar Malla, Cámara y Escena; no deben adoptar el estilo exclusivo de primitivas; comprobar Player y reapertura de proyecto.
9. Comparar visualmente lado a lado con referencia Unity aportada; entregar capturas de Cubo, Escalera y material compartido, y logs de los cuatro comandos de QA.

## Evidencia automatizada, sin sobredeclaración

- 24/24 PASS nuevo; 85/85 PASS nuevo+material+escala; 228 PASS y 2 FAIL en ampliada (`G005-13`, `SCENE-09`, ambos reproducidos sobre S00 sin el cambio).
- `test-editor-inspector-integration-corr-g001.mjs`: 8 fallos heredados `Unexpected token 'export'` (se reprodujeron sobre S00), no corregidos fuera del alcance.
- `scripts/fixtures/editor/inspector-primitives-ux-s01-g001.html`: Vue `Inspector.vue` y `MaterialSection.vue`, con Three WebGL, comprobaciones de cabecera, secciones, controles y CSS. Runner no ejecutado sin Vite.
- `npm run build`: `vite: not found`. Esto **no equivale** a fallo del código nuevo; tampoco demuestra compilación.

**Criterio de cierre:** QA Electron y visual PASS realizado por usuario, ausencia de regresiones sobre recursos y persistencia, aprobación explícita y posterior actualización de ledger. No declarar cierre hasta entonces.
