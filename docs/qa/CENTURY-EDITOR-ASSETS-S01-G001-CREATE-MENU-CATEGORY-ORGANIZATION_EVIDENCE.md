# Evidencia — CENTURY-EDITOR-ASSETS-S01-G001-CREATE-MENU-CATEGORY-ORGANIZATION

## Fuente y alcance

Comparación con `source_baseline(6).zip`. Código modificado solo en `src/components/ProjectPanel.vue`. Prueba específica en `scripts/test-editor-assets-create-menu-categories-g001.mjs`. Sin operación Git ni comprobación del repositorio externo.

## Pruebas ejecutadas

- `node --test scripts/test-editor-assets-create-menu-categories-g001.mjs`: **7/7 PASS**. Verifica agrupación, identidad de las 18 hojas originales de la raíz, ausencia de duplicados, restricciones para carpetas ordinarias/Cinematics/System UI, argumentos de callbacks y reutilización de submenús laterales del componente existente.
- Combinación de pruebas nuevas y heredadas (`test-editor-assets-s03-g001.mjs`, `test-editor-menus-ux-s01-g001-integral.mjs`, `test-editor-menus-ux-s01-g001-integral-electron.mjs`): **23/27 PASS y 4 FAIL**. Fallaron S03-01, S03-05, MENU-E01 y MENU-03.
- Ejecución comparativa de esas **20 pruebas heredadas sobre el ZIP original sin cambios**: **16/20 PASS, los mismos 4 FAIL**. Por tanto, no se atribuyen a la agrupación actual.
- `npm run build`: **bloqueado**, salida `vite: not found` (127).
- Consulta de registro npm: **sin acceso** (`EAI_AGAIN`); no se instalaron dependencias.

La prueba de posición lateral en Node inspecciona el contrato de `MenuList.vue`, no sustituye interacción real del usuario con Electron.

## Pendientes de QA local

1. Abrir **+ Crear** en Assets y carpeta ordinaria; comprobar hover, clic y selección de recursos de las cinco categorías.
2. Abrir **Crear** mediante clic derecho en fondo y **Crear aquí** desde cuadrícula/lista y árbol; navegar dos niveles de submenús cuando corresponda.
3. Confirmar que los submenús se abren a la derecha sin mover la lista principal, cambian a la izquierda cerca del borde y no se cierran al atravesar la unión entre paneles.
4. Verificar teclado (flechas, Entrar, Escape), foco, límites superior/inferior y scroll en pantallas pequeñas.
5. Crear realmente Escena, Prefab, Script, Shader, Material, Perfil, VFX, GameManager, UI, Timeline y Cinematic; comprobar rutas y guardado.
6. Confirmar restricciones de `Assets/Cinematics`, sus descendientes y carpeta System UI; verificar importación FilmMaker donde antes estaba disponible.

**Implementado:** SÍ. **Test Node focal:** PASS. **Compilado:** NO. **QA Electron:** NO VERIFICADO. **Aprobado:** NO. **Cerrado:** NO.
