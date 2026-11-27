# Matriz preliminar de cobertura — LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-CA-G001

**Base:** `lf(10).zip` preservado en el SOURCE_BASELINE candidato; inventario de `docs/architecture/LF-TIMELINE-UNIVERSAL-PROPERTY-INSPECTOR-TRACK-CLEANUP-S13-G008-INTEGRAL_FIELD_INVENTORY.md`.

**ALCANCE DEL RECUENTO:** 233 contenedores `class="field"` detectados en nueve componentes Vue. **No son 233 propiedades distintas**. Hay secciones condicionales, control compuesto/dinámico, controles fuera de `.field`, heredados y acciones de editor. El inventario detallado anterior guarda ruta y línea. Esta matriz establece obligaciones y bloqueos; no declara cobertura funcional completa.

## 1. Fuente de tipos

`src/engine/runtime/nodes/index.js` importa 28 módulos de registro de nodos, con definiciones derivadas y física; `registry.js` registra metadata `def.animation` cuando existe. El catálogo compartido `src/engine/runtime/anim/model.js` contiene **seis canales** base y cuatro valores tipados. Esta diferencia con los cientos de controles demuestra el trabajo pendiente.

## 2. Matriz por familia (lectores/aplicadores NO certificados salvo los declarados)

| Nodo / componente | Ejemplos de campos observados en Inspector | Tipo/semántica futura | Lector real (candidato) | Dueño/aplicador a auditar | Estado/QA y Gate técnico |
|---|---|---|---|---|---|
| Node/Node3D, Group, Mesh, Primitive, Model | Posición, Rotación, Escala y tamaño, Visible, Active, DontDestroyOnLoad | Vec3/rotación/booleano; tamaño puede ser derivado | `obj.position/rotation/scale`, flags | Escena y renderer; jerarquía gestiona Visible/Active | 3 transformaciones parciales; otros PENDIENTES · base común |
| Light | Energía, color, tipo de luz, alcance, ángulo, sombra, efectos | Number/color/enum/bool; cambio tipo discreto | `obj.light.*`, `obj.color` | `nodes/light.js`, host luz, renderer | Energy/color parcial; acceso `object3D` NO CERTIFICADO · G007 + Light |
| Camera3D | Posición, Rotación, FOV y parámetros de cámara | Vec3/number/discreto | `obj.position`, `obj.rotation`, `obj.props` | Camera Orchestration S15 / `nodes/camera.js` | Pose y binding existentes; FOV no general · Gate Camera3D antes de G010 funcional |
| RigidBody3D, StaticBody3D, CharacterBody3D, CollisionShape3D, Area3D | Masa, escala gravedad, rozamiento, rebote, amortiguación, forma, tamaño y velocidad | Number/vec3/bool/enum, cambios con policy física | `obj.props`, forma física | Jolt, nodos physics, bake | BLOQUEADO para dinámicos sin política por valor; propia certificación física |
| Canvas y widgets UI | Capa, render/input, dimensiones, opacidad, referencias `.ui` | Number/bool/ref/enum | `obj.props` y UI resource | UI Manager / compositor Canvas | PENDIENTE · mecanismo de propiedad Canvas antes de G009 funcional |
| Audio node y Audio Mixer | Volumen, pitch, pan, reproducción, grupo, rutas | Number/discreto/evento | `obj.props`/mixer settings | audio host/mixer actual | PENDIENTE; no duplicar automatización de clips; Gate audio |
| Material, Sprite3D/2D, Text, Decal | Color, opacity, roughness, metallic, shader, textura, UV, billboard | Number/color/bool/ref/enum | `obj.props`, material asset | renderer/material de Three.js y Assets | PENDIENTE; materiales compartidos requieren ownership de instancia; Gate render |
| VFX, Particles, Weather, PostProcessVolume, Atmosphere | Intensidad, seed, opciones de FX y postproceso | Number/vec/bool/ref/enum | `obj.props` y recursos | VFX/weather/postprocessing originales | PENDIENTE; Gate VFX/render |
| Terrain, Road, Water, Nature, LiquidResource | Semillas, dimensiones, caudales, calidad, superficie, propiedades físicas | Number/vec/bool/ref, algunas estructurales | `obj.props`, recursos | generadores propietarios de Terreno/Agua/Naturaleza | PENDIENTE; no regenerar geometría por frame; Gate naturaleza/recursos |
| Trigger, Event, GameplayObject, Spawn, Navigation, Critters | Monitoreo, triggers, referencias, velocidad, parámetros gameplay | Number/bool/enum/ref/evento | `obj.props` y database | runtime eventos, navegación/IA, NodeScriptRuntime | PENDIENTE; preservar eventos, señales y scripts; Gate gameplay |
| Props de scripts expuestos | Campos script configurables (cuando existan) | Tipo declarado / discreto | Script host; NO inferir desde estado interno | NodeScriptRuntime y contrato scripting | NO VERIFICADO · auditar API de export y writer; Gate scripts |
| Identidad y controles de editor | ID, nombre, organización de escena, reset, crear prefab, campos calculados | No todas son propiedades animables de valor | Meta autoral | Editor/proyecto/ciclo de vida | Clasificar acciones como eventos o editor-only con resolución contractual; no usar setter arbitrario |

## 3. Columnas obligatorias por propiedad en QA técnico

Cada una de las filas del inventario estático deberá evolucionar a **registro único verificado**: `tipoNodo`, `componente`, `rutaEditor`, `idCanónico`, `campo`, `tipoValor`, `getterAutoral`, `getterRuntime`, `setterDueño`, `estrategia`, `autoridad`, `captura`, `restauración`, `persistencia`, `pruebaNode`, `pruebaElectron`, `pruebaPlayer`, `estado`, `evidencia`, `Gate`. Una fila dinámica o de recurso compartido exige instanciar un ejemplo para confirmar el destino; no se permite adivinarlo desde expresiones del template.

**Criterio de exhaustividad:** comparar el inventario estático ampliado con introspección del Inspector real bajo al menos un ejemplar de cada `allDefs()` y cada clase de recursos, incluidos paneles secundarios. Toda propiedad editable debe tener una fila certificada o una restricción explícita resuelta; la cifra 233 no es una meta de porcentaje. Sin esa prueba, cobertura universal permanece NO VERIFICADA.
