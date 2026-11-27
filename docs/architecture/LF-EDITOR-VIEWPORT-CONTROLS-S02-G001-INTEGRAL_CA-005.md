# Contract Amendment — LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL / CA-005

**Estado:** CORR-002 solicitada durante QA local; implementada para nueva validación. Gate S02 autorizado, **NO APROBADO** aún. No abre un Sprint ni un Gate adicional.

**Autoridad de origen:** captura de QA local `docs/qa/evidence/LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL/user-camera-facing-handles.png` y declaración «Aprobado parcialmente. El gizmo nunca mira [...] en Unity puedo mover atrás del cubo y el gizmo [...] cambia de ángulo y mira hacia donde miro». 

**Contradicción resuelta:** CA-004 exigía borrar físicamente todas las asas negativas y mantener únicamente las positivas. Eso impide que las asas cambien de lado al orbitar detrás del objeto. **CA-005 sustituye exclusivamente los apartados 1, 2 y 4 de CA-004** respecto al extremo elegido y al mecanismo de ocultación. Se conserva el requisito de una sola asa por eje, tamaño del usuario, todos los demás requisitos de CA-003/004 y sus restricciones.

## Nuevo contrato visual y funcional

1. **Una sola asa activa por eje:** tanto Mover como Escalar muestran una sola punta/cubo X, Y y Z. No aparecen dos extremos del mismo eje a la vez.
2. **Orientación según la cámara:** al orbitar, cada asa se sitúa en el semieje más cercano a la cámara. Es posible que el extremo visible sea el negativo en coordenadas mundiales; ello **no** crea controles adicionales ni invierte la semántica de X/Y/Z. La línea visible sigue al extremo seleccionado. Al cruzar planos axiales, aplicar una pequeña histéresis; al arrastrar, congelar la elección hasta soltar.
3. **Selector sincronizado:** el picker del extremo oculto se deshabilita para `Raycaster` de Three.js mediante la máscara de capas, ya que `visible=false` no evita las intersecciones. La malla visible y el picker deben coincidir en todo momento.
4. **Orientación Global/Local:** calcular el lado visible contra los ejes mundiales de Mover/Global, contra la rotación mundial del objeto en Mover/Local y contra la rotación local de Escalar, que Three.js siempre interpreta como local. Incluye padres rotados y multiselección sin cambios de transformaciones.
5. **Tamaños sin cambios:** factores 0.50 Escala, 0.85 Mover, 0.95 Rotar, multiplicados por `store.prefs.gizmoSize`. Universal reutiliza los mismos; ningún tamaño nuevo o ajuste persistente.
6. **Sin intervención ajena:** Rotar, Snap/Shift, historial, FilmMaker, Terrain, Edit Mesh, Player, serialización, exportación, docking y controles Escena/Juego fuera del cambio correctivo.

## Mecanismo técnico autorizado por corrección del Gate

Reutilizar las geometrías originales de `TransformControls` r186.1, sin crear un segundo gizmo ni alterar `node_modules`. `src/core/editor/gizmo.js::_cameraFacingHandles` conserva ambos extremos del addon internamente, y tras la actualización nativa de las matrices del gizmo escoge una malla/picker por eje y refleja la línea original. Se verifica compatibilidad de estructura del addon de forma explícita y no se cambia la lógica de desplazamiento/escala del control. El cálculo por actualización reutiliza un vector para no generar objetos por fotograma.

**Dependencia de implementación privada:** `TransformControls._gizmo` no es API pública garantizada. La prueba Electron debe utilizar la versión exacta de Three.js instalada y validar las geometrías, máscaras de selección y ambas vistas de cámara. Si cambia la estructura interna, el mecanismo debe fallar explícitamente en vez de dejar ejes desincronizados.

**Evidencia requerida:** Node focal y ampliada; Electron embebido con addon real, 30 verificaciones; `npm run build` para Editor+Player; QA visual con órbita frente/detrás, Global/Local, padre rotado, preferencias de tamaño, Universal, Snap, selección y gestos de arrastre. Sin esas pruebas y aprobación expresa, S02 permanece **NO CERRADO**.
