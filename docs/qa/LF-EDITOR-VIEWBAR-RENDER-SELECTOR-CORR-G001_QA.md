> **Evidencia histórica:** pruebas con la ubicación de render según CA-001. CA-002 la sustituyó; consultar `LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001_QA.md` para QA vigente. No se invalidan los resultados obtenidos cuando se ejecutaron.

# QA — LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001

**Gate autorizado:** `Listo. LF-EDITOR-VIEWBAR-RENDER-SELECTOR-CORR-G001 autoriza comenzar`.
**Amendment:** `docs/architecture/LF-EDITOR-VIEWBAR-UX-CA-001.md`.
**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILADO NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia automatizada

- `node --test scripts/test-editor-viewbar-render-selector-corr-g001.mjs`: **10/10 PASS** en el Gate.
- `npm run test:viewbar-ux`: **12/12 PASS**, incluyendo VIEWBAR-02 y VIEWBAR-07 adaptadas expresamente a CA-001; el resto permanece intacto.
- `npm run test:viewbar-render-selector`: **143/143 PASS, 0 FAIL, 0 SKIP**, incluye ViewBar (22), FOV horizontal, Escena, Snap/Shift y Assets DnD. Probar nuevamente desde extracción limpia del SOURCE_BASELINE entregado.
- `npm run build`, `npm run docs:build`, `npm run docs:check`: intentar localmente después de `npm ci`; en el entorno de entrega `vite` y las dependencias de generación HTML no están instalados. **NO VERIFICADO**.
- Compilación y QA local del Editor y Player exportado: **NO VERIFICADO**; no confundir la estructura Vue y las pruebas Node con ejecución gráfica.

## Escenarios manuales obligatorios (usuario)

1. En **Escena**, junto a los controles de visualización, se ve selector compacto. `Portátil` aplica Mobile; `PC` aplica Forward+; `Compatibilidad` aplica Compatibility. El tooltip y el dropdown son legibles.
2. `Del proyecto` (cualquier método persistente) restaura el resultado de `project.render`. Cambia el método del proyecto en Juego → Ajustes y repite: la etiqueta refleja el nuevo método, sin introducir un override al abrir el proyecto.
3. Alterna los cuatro elementos tanto desde **Ver → Render del viewport** como desde el selector; ambos reflejan el estado de forma bidireccional.
4. Guarda/reabre y comprueba que `project.render` y Player exportado NO se alteraron por el selector del viewport.
5. Confirma que en **Juego** siguen aspecto, escala, maximizar, silenciar y Stats, sin duplicar el selector de escena.
6. Prueba ventanas estrechas, Linux/Windows, foco por Tab y flechas/Enter/Espacio, ausencia de solapamientos con grupos y scroll horizontal de ViewBar.
7. En Edit Mesh y preferencias, comprueba que FOV, navegación, gizmos y cámara no reaparecieron en la barra y que Snap/vistas siguen funcionando.
8. Devuelve logs completos, captura de barra y opciones, comparación del menú Ver y resultado de Play/Player.

**Cierre:** requiere compilación, QA local, evidencia y aprobación explícita del usuario. Hasta entonces queda IMPLEMENTADO, pero NO CERRADO.
