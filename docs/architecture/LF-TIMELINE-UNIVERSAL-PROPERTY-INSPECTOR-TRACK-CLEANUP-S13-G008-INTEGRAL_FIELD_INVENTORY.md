# Inventario de superficies del Inspector — auditoría estática

Fecha: 2026-11-10. Referencia: `lf(10).zip` suministrado por usuario.

**Método:** enumeración de contenedores literales `class="field"` en los componentes mencionados, con línea y etiqueta cuando se puede extraer. **No equivale a todas las propiedades del motor ni a todos los controles dinámicos**; `ParamForm`, editores de recursos, secciones condicionales y composición Reactiva requieren instrumentación Electron y cruce con los propietarios. La columna «ruta candidata» es sintáctica, NO autoriza un setter ni garantiza pertenencia. **Ninguna fila se declara soportada por esta enumeración.**

| Archivo | Contenedores `field` detectados |
|---|---:|
| `Inspector.vue` | 178 |
| `MaterialSection.vue` | 14 |
| `SpriteSection.vue` | 13 |
| `InteractionZonesPanel.vue` | 8 |
| `AudioMixerInspector.vue` | 7 |
| `LiquidResourceEditor.vue` | 4 |
| `MaterialSurfaceDetail.vue` | 5 |
| `ColorPickerPanel.vue` | 2 |
| `MaterialShader.vue` | 2 |

Total observado en estas superficies: **233** contenedores, NO propiedades únicas.

| Componente | Línea | Etiqueta detectada | Ruta de lectura candidata | Estado |
|---|---:|---|---|---|
| Inspector.vue | 257 | Visible | obj.visible | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 258 | DontDestroyOnLoad | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 267 | Posición | obj.position, obj.rotation, obj.scale | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 268 | Rotación ° | obj.rotation, obj.scale | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 269 | {{ obj.type === 'primitive' ? 'Tamaño' : 'Escala' }} | obj.scale | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 270 | Escala × | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 279 | {{ spec.label }} | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 287 | Recipiente abierto | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 289 | Forma interior | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 290 | Interior (m) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 291 | Líquido | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 294 | Volumen inicial (m³) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 295 | Caudal de salida | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 303 | Combustible | obj.props?.combustion?.enabled, obj.props?.combustion, obj.props.combustion.ignited | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 305 | Ignición inicial | obj.props.combustion.ignited, obj.props.combustion, obj.props.combustion.moisture | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 306 | Humedad | obj.props.combustion.moisture, obj.props.combustion, obj.props.combustion.ignitionK | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 307 | Temperatura de ignición (K) | obj.props.combustion.ignitionK, obj.props.combustion | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 317 | Masa (kg) | obj.props.mass, obj.props.gravityScale, obj.props.linearDamping | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 318 | Escala gravedad | obj.props.gravityScale, obj.props.linearDamping, obj.props.angularDamping | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 319 | Amortiguación lineal | obj.props.linearDamping, obj.props.angularDamping, obj.props.canSleep | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 320 | Amortiguación angular | obj.props.angularDamping, obj.props.canSleep | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 321 | Puede dormir | obj.props.canSleep, obj.props.friction | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 323 | Rozamiento | obj.props.friction, obj.props.restitution | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 324 | Rebote | obj.props.restitution | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 332 | Velocidad (m/s) | obj.props.velocity, obj.props.maxSlopeAngle, obj.props.stepHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 333 | Pendiente máxima (°) | obj.props.maxSlopeAngle, obj.props.stepHeight, obj.props.floorSnap | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 334 | Altura escalón (m) | obj.props.stepHeight, obj.props.floorSnap, obj.props.gravity | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 335 | Snap suelo (m) | obj.props.floorSnap, obj.props.gravity, obj.props.mass | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 336 | Gravedad (m/s²) | obj.props.gravity, obj.props.mass | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 337 | Masa (kg) | obj.props.mass | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 344 | Monitoring | obj.props.monitoring, obj.props.monitorable | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 345 | Monitorable | obj.props.monitorable | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 351 | Forma | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 355 | Autoajuste a geometría | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 356 | Tamaño (m) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 362 | Malla de origen | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 370 | Radio (m) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 371 | Altura total (m) | obj.props.disabled | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 373 | Desactivada | obj.props.disabled | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 382 | Recibe cortes | obj.props.carve | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 406 | Malla objetivo | obj.props.targetId | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 410 | Textura | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 420 | Ancho / Alto / Profundidad | obj.props.size, obj.props.opacity | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 421 | Opacidad | obj.props.opacity | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 458 | Recurso | obj.props?.vfxId | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 468 | Activo | obj.props?.enabled, obj.props?.seed | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 469 | Semilla | obj.props?.seed | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 478 | Color | obj.color, obj.props?.windSway | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 479 | Sombra | obj.props?.windSway | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 480 | Influencia del viento | obj.props?.windSway | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 492 | Color | obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 501 | Sombra | obj.props?.batchStatic | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 502 | Decoración estática (batch) | obj.props?.batchStatic | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 503 | GI | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 506 | Escala lightmap | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 516 | Texto | obj.props.text, obj.props.font | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 517 | Fuente | obj.props.font | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 520 | Alineación | obj.props.align | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 523 | Altura letra | obj.props.size, obj.props.depth, obj.props.bevel | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 524 | Profundidad | obj.props.depth, obj.props.bevel, obj.props.lineHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 525 | Bisel | obj.props.bevel, obj.props.lineHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 526 | Interlineado | obj.props.lineHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 534 | Emite luz | obj.props.neon, obj.props.neonColor | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 536 | Color | obj.props.neonColor, obj.props.neonEnergy | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 537 | Brillo | obj.props.neonEnergy, obj.props.neonLight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 538 | Forma de luz | obj.props.neonLight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 542 | Energía luz | obj.props.neonLightEnergy, obj.props.neonRange, obj.props.neonLight, obj.props.neonAngle | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 543 | Rango | obj.props.neonRange, obj.props.neonLight, obj.props.neonAngle | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 544 | Ángulo ° | obj.props.neonLight, obj.props.neonAngle | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 554 | Escalones | obj.props.steps, obj.props.turn, obj.props.sides | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 555 | Giro ° | obj.props.turn, obj.props.sides | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 556 | Laterales | obj.props.sides, obj.props.sideHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 558 | Altura lateral (m) | obj.props.sideHeight, obj.props.sideThickness | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 559 | Grosor lateral (m) | obj.props.sideThickness | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 571 | Volumen | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 580 | Recibe cortes | obj.props.carve | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 589 | Geometría vinculada | obj.props.meshRef | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 600 | Tipo | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 606 | Color | obj.color, obj.light.energy, obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 607 | Energía | obj.light.energy, obj.light.type, obj.light.range | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 608 | Rango | obj.light.type, obj.light.range | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 609 | Ancho (m) | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 610 | Alto (m) | obj.light.type, obj.light.spotAngle | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 612 | Ángulo ° | obj.light.type, obj.light.spotAngle | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 613 | Penumbra | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 615 | Lensflare | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 617 | Tamaño flare (px) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 618 | Intensidad flare | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 622 | Temperatura K | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 624 | Modo | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 630 | Sombras | obj.light.type, obj.light.shadow | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 632 | Resolución | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 635 | Sesgo | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 636 | Sesgo normal | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 637 | Distancia (m) | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 639 | Volumétrica | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 640 | Intensidad vol. | obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 642 | Animación | obj.light.style | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 649 | Velocidad | obj.light.speed, obj.light.amount | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 650 | Intensidad fx | obj.light.amount, obj.light.type | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 659 | Etiqueta | obj.props.tag | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 668 | Uso | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 675 | Recurso UI | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 682 | (sin etiqueta explícita) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 686 | Resolución | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 689 | Capa | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 690 | Visible al iniciar | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 691 | Recibe clics | obj.name | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 692 | Modal | obj.name | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 700 | Cámara principal | obj.props.main, obj.props.fov | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 702 | FOV ° | obj.props.fov | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 709 | Cámara objetivo | obj.props.camera | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 715 | Activado | obj.props.enabled, obj.props.autoPlay, obj.props.loop | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 716 | Reproducir al iniciar | obj.props.autoPlay, obj.props.loop, obj.props.pattern | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 717 | Bucle | obj.props.loop, obj.props.pattern | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 718 | Patrón | obj.props.pattern | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 722 | Animación | obj.props.clip | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 728 | Desplazamiento XYZ (m) | obj.props.pattern, obj.props.position, obj.props.rotation | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 729 | Rotación XYZ (°) | obj.props.pattern, obj.props.rotation, obj.props.frequency | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 730 | Frecuencia (Hz) | obj.props.pattern, obj.props.frequency, obj.props.positionFrequency | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 732 | Frecuencia XYZ · desplazamiento (×) | obj.props.positionFrequency, obj.props.rotationFrequency, obj.props.positionPhase | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 733 | Frecuencia XYZ · rotación (×) | obj.props.rotationFrequency, obj.props.positionPhase, obj.props.rotationPhase | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 734 | Fase XYZ · desplazamiento (°) | obj.props.positionPhase, obj.props.rotationPhase, obj.props.duration | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 735 | Fase XYZ · rotación (°) | obj.props.rotationPhase, obj.props.duration | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 736 | Duración del impulso (s, 0 = automático) | obj.props.duration, obj.props.blendIn | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 738 | Blend In (s) | obj.props.blendIn, obj.props.blendOut | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 739 | Blend Out (s) | obj.props.blendOut | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 747 | Tipo | obj.props.recordKind | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 750 | Database | obj.props.recordId, obj.props.recordKind | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 754 | Recogida | obj.props.mode | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 758 | Slot | obj.props.slot | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 761 | Enemigo objetivo | obj.props.recordKind, obj.props.targetEnemy | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 765 | Alcance (m) | obj.props.reach, obj.props.showIndicator, obj.props.indicatorZones | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 766 | Indicador | obj.props.showIndicator, obj.props.indicatorZones, obj.props.reach | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 776 | Páginas | obj.props.pages?.length, obj.props.pages, obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 777 | Color | obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 785 | Clip | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 799 | Salida | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 802 | Tipo | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 806 | Silenciar | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 807 | Al empezar | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 808 | Bucle | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 809 | Volumen | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 810 | Tono | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 811 | Retardo (s) | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 814 | Distancia mín. | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 815 | Distancia máx. | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 816 | Atenuación | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 819 | Cono interior ° | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 820 | Cono exterior ° | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 821 | Volumen fuera | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 822 | HRTF | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 823 | Oclusión | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 833 | Especie | (destino no deducible por lectura estática) | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 842 | Etiqueta | obj.props.tag, obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 843 | Color | obj.color, obj.props.onEnter | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 845 | Al entrar | obj.props.onEnter, obj.props.onExit, obj.props.look | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 846 | Al salir | obj.props.onExit, obj.props.look | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 847 | Mirada | obj.props.look, obj.props.lookDistance | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 849 | Alcance (m) | obj.props.lookDistance, obj.props.onLook, obj.props.onLookEnd | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 850 | Al mirar | obj.props.onLook, obj.props.onLookEnd | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 851 | Al dejar de mirar | obj.props.onLookEnd | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 861 | Activo | obj.props.enabled, obj.props.shape | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 862 | Forma | obj.props.shape, obj.props.priority | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 864 | Prioridad | obj.props.priority, obj.props.weight, obj.props.blendDistance | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 865 | Peso | obj.props.weight, obj.props.blendDistance, obj.props.blendTime | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 866 | Distancia de mezcla (m) | obj.props.blendDistance, obj.props.blendTime, obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 867 | Transición (s) | obj.props.blendTime, obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 868 | Color de edición | obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 876 | Color | obj.color, obj.props.exchange | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 877 | Intercambio · {{ (obj.props.exchange ?? 0).toFixed(2) }} | obj.props.exchange | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 885 | Celda (m) | obj.props.cell, obj.props.agentRadius, obj.props.agentHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 886 | Radio agente | obj.props.agentRadius, obj.props.agentHeight, obj.props.maxSlope | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 887 | Altura agente | obj.props.agentHeight, obj.props.maxSlope, obj.props.stepHeight | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 888 | Pendiente máx. ° | obj.props.maxSlope, obj.props.stepHeight, obj.props.layers | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 889 | Escalón máx. | obj.props.stepHeight, obj.props.layers, obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 890 | Capas | obj.props.layers, obj.color | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| Inspector.vue | 891 | Color | obj.color, obj.props.asset | POR AUDITAR / CONTRASTAR CON DESCRIPTOR |
| MaterialSection.vue | 88 | Recurso | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 103 | Albedo | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 104 | {{ f.label }} | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 114 | Participa | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 115 | Retención (mm) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 116 | Escurrimiento (m/s) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 120 | Habilitado | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 121 | Superficie | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 122 | Clip {{ i+1 }} | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 130 | Volumen | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 131 | Tono aleatorio | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 132 | Máx./segundo | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 135 | {{ f.label }} | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSection.vue | 138 | Color tela | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 37 | (sin etiqueta explícita) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 38 | Lienzo en blanco | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 40 | Tamaño del píxel (m) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 52 | X | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 53 | Y | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 58 | Mirar a la cámara | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 59 | Sin sombreado | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 60 | Visible por detrás | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 61 | Recorte de transparencia | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 63 | Capa | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 64 | Filtro | obj.color | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 65 | Voltear | obj.color | SIN CERTIFICACIÓN INDIVIDUAL |
| SpriteSection.vue | 66 | Tinte | obj.color | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 20 | Figura | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 23 | Radio (m) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 27 | Tamaño X/Y/Z | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 28 | Giro X/Y/Z (°) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 30 | Centro X/Y/Z | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 35 | Anillo X/Y/Z | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 36 | Letra X/Y/Z | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| InteractionZonesPanel.vue | 37 | Escala | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 88 | Nombre | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 89 | Volumen | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 90 | Volumen | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 92 | Silencio | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 93 | Bypass de efectos | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 94 | Salida{{ g.name }} | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| AudioMixerInspector.vue | 120 | Añadir efecto= 16" :value="''" @change="addEffect($event.target.value);$event.target.value | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| LiquidResourceEditor.vue | 14 | Densidad (kg/m³) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| LiquidResourceEditor.vue | 15 | Viscosidad relativa | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| LiquidResourceEditor.vue | 16 | Color | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| LiquidResourceEditor.vue | 17 | Opacidad | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSurfaceDetail.vue | 32 | Modo | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSurfaceDetail.vue | 38 | Imagen | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSurfaceDetail.vue | 47 | Intensidad | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSurfaceDetail.vue | 51 | Microdetalle | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialSurfaceDetail.vue | 54 | Escala micro (m) | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| ColorPickerPanel.vue | 19 | Color | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| ColorPickerPanel.vue | 20 | Hexadecimal | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialShader.vue | 43 | Shader | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |
| MaterialShader.vue | 53 | Mapeo | (destino no deducible por lectura estática) | SIN CERTIFICACIÓN INDIVIDUAL |


**Pendiente:** correlar cada fila con su `getDef()`/subrecurso, semántica de escritura, evaluación, restauración, Jolt, Editor/Player y QA real. No inferir compatibilidad a partir de rutas candidatas.
