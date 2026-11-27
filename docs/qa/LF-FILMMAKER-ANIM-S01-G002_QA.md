# LF-FILMMAKER-ANIM-S01-G002 — QA

**Estado:** IMPLEMENTADO · 150/150 Node PASS · COMPILACIÓN NO VERIFICADA · QA Electron/WebGL NO VERIFICADO · CIERRE PENDIENTE.

## Test automatizado ejecutado

```bash
node --test \
  scripts/test-filmmaker-anim-s01-g002.mjs \
  scripts/test-filmmaker-anim-s01-g001.mjs \
  scripts/test-filmmaker-ux-s01-g002-corr001.mjs \
  scripts/test-filmmaker-ux-s01-g002.mjs \
  scripts/test-filmmaker-frame-s01-g001.mjs \
  scripts/test-road-material-s01-g001.mjs \
  scripts/test-editor-safety-s01-g001.mjs \
  scripts/test-editor-safety-s01-g002.mjs \
  scripts/test-vfx-editor-s03-g001.mjs \
  scripts/test-vfx-simulation-s02-g001.mjs \
  scripts/test-project-safe.mjs \
  scripts/test-resource-history-corr-g001.mjs
```

Resultado verificado: **21 nuevas + 129 regresión = 150 PASS, 0 FAIL, 0 SKIP**.
`npm run build` → `vite: not found` (dependencias no presentes en este contenedor). NO VERIFICADO en compilación; no se declara error de código por esta circunstancia.

## Secuencia QA local obligatoria

1. Cargar un proyecto de prueba (nunca el único ejemplar del proyecto real). En Jerarquía seleccionar un nodo 3D compatible denominado Vaso (ejemplo manual, **no** asset instalado).
2. Entrar en el tab Timeline, activar **Animar** y pulsar **+ Nodo…**; debe aparecer un grupo con ID estable y sin pistas duplicadas.
3. Agregar subpistas Posición y Rotación; crear keyframes en T=0 mediante ◆. Mover el cabezal a T=0,60 s y activar **Auto-key**.
4. Usar el gizmo Mover y Rotar para representar la caída, un drag por propiedad. Al soltar, comprobar que aparece un rombo y el historial de película aumenta en **una** operación por drag; Undo/Redo restaura correctamente.
5. Desactivar Auto-key, mover gizmo de nuevo: no debe crear clave ni persistir una pose intermedia.
6. Buscar T=0, T=0,30 y T=0,60 sin reproducir, ida y vuelta. Debe ser determinista y no ejecutar Event Order Flow, scripts de gameplay ni física. Sin añadir plano de cámara, pulsar Play en el timeline para previsualizar las claves del nodo y detener; no debe iniciarse gameplay.
7. Cambiar tiempo/valores/interpolación desde panel contextual; mover un rombo a otro instante, comprobar rechazo de claves superpuestas y funcionamiento de Delete.
8. Silenciar y desilenciar pista; los rombos se conservan. Renombrar nodo: ID/pista conservados. Eliminar nodo: pista huérfana, sin reasignación por nombre.
9. Guardar `.nfm`, cerrar y reabrir. Las pistas y keyframes deben conservarse. Comprobar que el Transform original de la escena y sus overrides NO han variado al recorrer la animación.
10. Iniciar y detener montaje con cámara, actor, texto, audio y efectos; todo debe seguir funcionando. Al terminar debe restaurarse la pose base. Revisar el control de reproducción normal de LevelForge.
11. Probar una selección de varios nodos y un nodo RigidBody3D: no debe grabarse nada ni modificarse el proyecto; diagnóstico entendible.
12. Evaluar a 1440×900, 1280×720 y 1024×768. Verificar diseño, scroll, panel de propiedades, herramientas de gizmo y acceso con teclado.
13. Ejecutar `npm run build`, `npm run filmmaker`, tests y prueba del ZIP JSZip real de S01-G001 si están instaladas las dependencias.

## QA delimitado por contrato

Este Gate no incluye bake físico, nodos de física simulados, export a Timeline de LevelForge ni Auto-key por edición del Inspector: quedan fuera del alcance.

**Solicitar evidencia:** captura de pistas dinámicas y viewport en T=0 / T=0,60; logs de build y test, grabación corta opcional del flujo y resultado de guardado/reapertura `.nfm`.
