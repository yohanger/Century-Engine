# S13-G004 · Inventario técnico y contraste contractual

**SOURCE_BASELINE base:** S13-G002 CORR-001 completo. Autoridad: contrato UX-01..08 ratificado, Scene Ownership S02, Fade S01, World/Bake existentes.

**Único archivo de producción modificado:** `src/components/ScenePanel.vue`.

- No se reconstruye Inspector ni se crea otra autoridad de datos.
- Estructuras gm-section, section-title y ownership-group se adaptan a `details/summary` nativos con IDs semánticos; `inspFold` sigue siendo la preferencia única.
- Se retira documentación activa, no avisos de seguridad, autoridad o referencia ausente.
- El reset de clima continúa incluyendo nubes/niebla; el reset global conserva bake; no se altera Player, World o Fade.
- Se añaden tests Node y fixture Electron con WebGL real; no se modifica ningún runner compartido.

**Pruebas ampliadas:** 121 PASS / 2 FAIL preexistentes idénticos en baseline (SCENE-09, S02-16). No se maquillan ni alteran. **Pruebas compatibles:** 88 PASS / 0 FAIL. Electron/build NO VERIFICADOS por falta de Vite.

**Dependencias posteriores:** G005 Terreno; G006 Recursos; G007 VFX; G008 Timeline/Audio; G009 Señales/Malla/Pintura; G010 integración. Tooltips globales únicamente después.
