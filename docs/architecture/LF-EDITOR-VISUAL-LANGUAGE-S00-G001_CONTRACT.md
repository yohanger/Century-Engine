# LF-EDITOR-VISUAL-LANGUAGE-S00-G001 — Contrato visual candidato

**Estado:** PROPUESTO POR LA AUDITORÍA · REQUIERE APROBACIÓN VISUAL DEL USUARIO. No aplicado en producción. Los siguientes Gates requieren su propia autorización literal.

## 1. Principios vinculantes tras aprobación

- **Referencia:** claridad, agrupación y escala compacta del Inspector de Unity 2021 mostrado por el usuario. Se toma como referencia visual; **no se impone clon literal ni se reutilizan imágenes propietarias**.
- **Alcance:** todas las ventanas del Editor, incluida FilmMaker, no el render del juego, materiales 3D ni UI exportada por el usuario.
- **Propiedad:** toda propiedad editable tiene una sola fuente de verdad. Dos vistas pueden consultar el mismo dato, pero no deberían duplicar controles sin razón contractual.
- **Reutilización:** extender `src/styles.css` y componentes de UI existentes, no crear un framework, otro estado global ni paletas por panel.
- **Legibilidad:** no ocultar acciones críticas; densidad uniforme, responsive real, soporte de teclado, foco visible.
- **Seguridad:** no alterar proyectos, escenas, runtime, Player, exportación ni preferencias existentes como efecto de cambio visual.

## 2. Especificación de diseño candidata (NO aplicada)

### 2.1 Paleta de referencia

Muestras aproximadas observadas en la captura comprimida del usuario: shell superior en torno a `#181818`, panel de jerarquía/Inspector `#383838`, superficie inferior `#333333`, encabezados entre `#292929` y `#3d3d3d`. Son **lecturas aproximadas de píxeles**, sujetas a compresión y configuración de pantalla; no representan valores oficiales de Unity.

| Rol visual | Propuesta | Regla |
|---|---|---|
| Shell / menú | `#181818` | Zona de ventana y barras superiores; separación por contraste suave. |
| Panel base | `#383838` | Jerarquía, Inspector, Assets, docks. |
| Panel inferior | `#333333` | Consistente con referencia; no negro absoluto. |
| Header sección | `#292929` o `#414141` según profundidad | Jerarquía clara mediante borde y cambio tonal mínimo. |
| Campo/input | `#414141` | Contraste suficiente con el panel y borde discreto. |
| Separador | `#262626` | Líneas finas, no cajas decorativas excesivas. |
| Texto principal | `#e1e1e1` | Alto contraste. |
| Texto secundario | `#bdbdbd` | Labels y metadatos legibles. |
| Texto terciario | `#a3a3a3` | Usar con moderación, no en controles críticos. |
| Selección neutra | `#555555` | Estados seleccionados en listas; foco diferenciado. |
| Focus y acción primaria | Acento azul **mínimo y funcional** | No inundar paneles con azul; mantener visible el foco de teclado. |
| Error/alerta | Rojo/ámbar semánticos | No neutralizar avisos de riesgo. |
| Carpeta | Gris neutro con contraste de forma | Sustituir amarillo fijo únicamente en S05. |
| Ejes XYZ | Rojo/verde/azul semánticos | No cambiar colores de coordenadas por tema. |

No sustituir masivamente `--amber`, `--blue`, ni literales hex: primero clasificar usos de selección, foco, riesgo, nodos, gráficos, ejes, materiales, Timeline y runtime. El Gate S06 propondrá el mapeo final y validará contrastes.

### 2.2 Densidad y estructura

- Base actual `12px`, toolbar `36px`, controles `24px`, encabezados `.sect` `26px`, panel `.panel-head` `30px`: **mantener provisionalmente** hasta QA visual comparativo; no escalar toda la aplicación por capricho.
- Inspector: cabecera de nodo separada del cuerpo, secciones plegables con borde superior/inferior claro, una fila por propiedad, grupos lógicos con títulos distintivos, valor alineado y campos numéricos coherentes.
- Dato redundante: mostrar una sola vez título/valor en un mismo nivel. No ocultar valores técnicos o funcionales sin confirmar quién los consume.
- Inspector de escena: jerarquía sugerida **Escena → Transiciones/GameManager; Mundo → Clima/Cielo/Nubes/Luz; Recursos → Bake**. Es agrupación conceptual, no traslado persistente aprobado.
- Assets: mantener vista lista predeterminada y grid opcional, árbol/navegación, filtro, ordenación, DnD, inspector de recursos, renombrado; carpeta gris en ambas vistas.
- Gizmos: visualmente tres ejes X/Y/Z para Move/Rotate, controles de plano al lado de cámara; sin crear `TransformControls` adicional. Edit Mesh permanece modal G/R/S, **sin gizmo**.
- Barra superior: **solo herramientas**; pistas temporales en franja inferior del viewport sin desplazar layout. No restaurar HUD textual superior.
- Modales y editores flotantes: conservan el patrón actual de ventana, foco/teclado y posicionamiento; revisar casos con formularios extensos.

### 2.3 Estados y accesibilidad

Distinguir por color **y forma/borde**: hover, selected, active, focused, disabled, error, pending, drag target. Evitar comunicar estado solo por color. Mantener `:focus-visible`, teclado, `aria-*` existente y tamaño clicable compatible con panel compacto. Contraste objetivo WCAG 2.2 AA (texto normal ≥4.5:1; elementos no textuales/controles relevantes ≥3:1), medido cuando se aplique. Reducir transiciones innecesarias en hardware de 4 GB.

### 2.4 Responsive y rendimiento

QA para **1366×768, 1024×600 y panel Inspector de 260px**, incluido cambio de pestañas, clipping, textos largos y escala de interfaz; opcional 1920×1080 como comparación. Evitar layout shifts por mensajes, scroll horizontal indeseado y nuevos observers/animaciones pesadas en cada componente.

## 3. Autoridad de datos: límites de los Gates futuros

- `ScenePanel.vue` presenta datos en `activeScene`, `project.environment` y `project.bake`: S02 deberá inventariar claves, migraciones, defaults, consumidores de shaders, World, Play/Player y persistencia antes de alterar ownership. Si contradice un contrato Weather aprobado, **BLOQUEAR** y redactar Contract Amendment.
- `TagLayerRow.vue` y `project.tagLayers` no se eliminan visualmente sin resolver el runtime; `groups` propuesto para **API scripting, no eventos**. El reemplazo requiere contrato y migración preservando comportamientos heredados sin convertir automáticamente `Trigger` ni `goScene` en Groups.
- El Inspector de Terreno requiere el Gate previamente pendiente, independiente de S01/S02 salvo integración formal.
- FilmMaker y herramientas especializadas podrán conservar tonos de semántica propia (grabación, pistas, llaves, audio), mapeados a roles visuales explícitos en S06; no eliminarlos porque sean distintos del gris.

## 4. QA de aceptación del diseño

1. Comparación lado a lado contra captura del usuario: separación clara de cabecera, bloques y filas.
2. Una primitiva con Transform/Material/Script/Prefab y sin propiedades inútiles *solo después de validación funcional*.
3. Escena: jerarquía visual sin repetir controles; test de equivalencia de datos/serialización antes y después.
4. Assets: carpetas grises, lista y grid, navegación, búsqueda, DnD, iconos, renombrado.
5. Gizmos: 3 ejes visuales, planos hacia la cámara, global/local, Snap, Undo/Redo, picking y regresión Object/Edit Mode.
6. Tema: uniformidad Editor + FilmMaker, foco y selección, ventanas estrechas, condiciones de bajo rendimiento.
7. Pruebas Node de comportamiento + Electron nativo y QA visual del usuario. Compilar **no** equivale a QA visual.

**Criterio de aprobación S00:** validación del contrato propuesto y del orden por parte del usuario; las implementaciones futuras se autorizan **Gate por Gate**.
