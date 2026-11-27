# LF-EDITOR-UX-S01-G005_EXT-001 — Material Blockout métrico

**Autorización:** `Listo. LF-EDITOR-UX-S01-G005_EXT-001 autoriza comenzar` (2026-10-26).
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_UX_S01_G005_SOURCE_BASELINE.zip` (749 archivos; Three.js 0.186.1).
**Alcance:** material de blockout incorporado, marca de 1 metro para nuevas primitivas, continuidad durante edición de malla, sustitución por textura o por otro shader y compatibilidad retroactiva. **Excluye Vertex Paint multicapa**, planificado en EXT-002.

## Integración y comportamiento

1. **Nuevo shader integrado `builtin:blockout`** en `src/engine/runtime/render/shaderlib.js`, registrado dentro de `BUILTIN_SHADERS`; por tanto aparece en el selector de `MaterialShader` existente. No crea renderizador, sistema de materiales, nuevos UV, ni archivos externos.
2. **Grilla visual de 1 m:** patrón gris ajedrezado con líneas cada 1 metro calculadas de forma triplanar en `Surface.position`; `fwidth` suaviza bordes a distintas distancias. Es un efecto del shader **sin geometría adicional ni subdivisión**. El mapeo inicial es `object`, adherido a la geometría y escalado según las dimensiones de la primitiva. Las dimensiones en metros y la política de escala de los nodos se mantienen.
3. **Valor por defecto solo en primitivas nuevas:** `nodes/primitive.js:create()` asigna `{ shader: 'builtin:blockout', mapping: 'object', params: {} }`, y color blanco como multiplicador neutro. Las siete primitivas existentes del catálogo heredan la configuración al crearse; no se migra ningún nodo guardado ni se cambia el shader global del proyecto.
4. **Sustituir textura sin salir del material:** en Inspector → Material → Shader: Blockout, el parámetro **Textura (sustituye blockout)** permite seleccionar una imagen de Assets; al asignarla el material muestra la imagen con mapeo triplanar y el parámetro «Tamaño de textura (m)» regula su repetición (1 m por defecto). Al quitarla regresa la cuadrícula métrica. El mismo selector de Shader permite reemplazar Blockout por «Realista (PBR)» o cualquier shader de usuario.
5. **Edición de malla:** `_convertToMesh` hornea las dimensiones en vértices y conserva `obj.mat`, color, propiedades de sombreado e historial. `EditSession` usa el `meshBody` con `syncPbrMaterial`, así que se ve el mismo patrón sobre caras, aristas y vértices sin escritura de UV. La geometría editable no obtiene vértices extra al entrar.
6. **Compatibilidad:** proyectos guardados sin `mat.shader` continúan bajo su shader efectivo clásico/por defecto. Los objetos existentes, Player y exportación se apoyan en la infraestructura PBR y de nodos compartida, sin rutas paralelas.

## Evidencia automatizada

- `node --test scripts/test-editor-ux-s01-g005-ext-001.mjs`: **13 PASS / 0 FAIL / 0 SKIP**. Comprueba registro, creación para las siete variantes, mutabilidad aislada, shader métrico, triplanar, sustitución por textura, escala de repetición, conservación de material al convertir, selectores Inspector, retrocompatibilidad, edición y Player compartido.
- Regresión `scripts/test-*.mjs` excluyendo `test-starcat.mjs`: **976 PASS / 0 FAIL / 18 SKIP**, 49 suites. No hay fallos reportados en esa ejecución. `test-starcat.mjs` depende de módulos Three.js no instalados y debe ejecutarse en el Linux del usuario.
- `node --check` para JavaScript modificado: PASS.
- `npm run build`: **NO VERIFICADO** (`vite: not found`). WebGL/Electron y el Player renderizado requieren QA del usuario.

## QA visual obligatorio en Linux

- [ ] Crear Cubo, Rampa, Escalera, Cilindro, Cono, Esfera y Plano; confirmar la cuadrícula blockout en cada nueva primitiva, sin material asignado a mano.
- [ ] Cubo nuevo de 1×1×1 m y cubo de 4×3×2 m: comprobar que cada casilla del patrón se mide en metros y no según el tamaño del UV. Revisar una cara frontal y otra lateral.
- [ ] Trasladar y rotar el objeto: en mapeo Objeto la textura permanece adherida a la superficie. Revisar escalas no uniformes, grupos padres y geometrías curvas.
- [ ] Entrar a edición de malla (Tab); modificar cara/vértices, subdividir y salir: patrón visible durante y después, sin una cuadrícula que añada polígonos reales.
- [ ] Hornear cortes CSG y revisar continuidad del blockout en las caras resultantes.
- [ ] Inspector → Material → Shader «Blockout» → seleccionar «Textura (sustituye blockout)» desde Assets: desaparece el patrón y aparece la imagen. Cambiar «Tamaño de textura (m)» y confirmar repetición.
- [ ] Quitar la textura: vuelve el patrón. Elegir shader Realista u otro material y verificar que reemplaza el blockout. Deshacer/rehacer cambios de material y conversión a malla.
- [ ] Abrir un proyecto antiguo que tenga primitivas grises con mat vacío o sin mat: no deben recibir blockout; nuevos objetos sí.
- [ ] Evaluar Play Mode y Player exportado con texturas, sombras, materiales, luces y perfiles Clásico/Realista. Comprobar batching e Inspector.
- [ ] `npm ci`, `node --test scripts/test-starcat.mjs`, `npm run build`, `npm run electron:dev`. Registrar capturas del patrón y de su sustitución en Player.

## Riesgos y límites conocidos

- «Textura Blockout» es un patrón procedural PBR, **no un PNG editable ni un recurso en Assets**. Esta elección elimina dependencias externas y evita errores de UV en caras nuevas. El diseño y las líneas de 1 m no implican nuevos polígonos.
- El mapeo de objeto se calcula con la longitud de los ejes de la matriz modelo y puede requerir revisión en grupos con escala no uniforme y rotaciones mezcladas; esta limitación ya corresponde al mapeo triplanar de la plataforma.
- No se comprueba la compilación GLSL real ni el resultado visual sin WebGL. Especial atención al antialiasing y a patrones pequeños a distancia.
- Vertex Paint con capas y pesos por vértice **no está implementado** en este Gate; corresponde a `LF-EDITOR-UX-S01-G005_EXT-002` mediante autorización independiente.

**Estado:** IMPLEMENTADO / NODE TEST PASS; compilación, WebGL y QA local PENDIENTES.
