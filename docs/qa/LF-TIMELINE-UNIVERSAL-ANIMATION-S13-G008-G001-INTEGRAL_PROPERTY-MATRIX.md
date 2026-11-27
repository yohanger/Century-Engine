# Inventario estático de campos — Animación Universal S13-G008-G001

**Estado:** AUDITORÍA PARCIAL (código estático). No constituye QA universal ni autoriza considerar todos estos campos propiedades de nodo.

- 259 apariciones de contenedores `class="field"` en los once componentes analizados; 17 llevan llave explícita en el Inspector principal.
- Un campo puede ser meramente un control de recurso, derivado, acción del editor, o incluir múltiples valores. Estos renglones **NO** son propiedades únicas y requieren identificar el propietario real.
- Los canales base (`position`, `rotation`, `scale`, `visible`, `light.energy`, `light.color`) existen antes de este Gate. Nuevas declaraciones de propietario: `camera.fov` y diez numéricas de iluminación. No se ha certificado el 100 % de las propiedades.
- Las rutas `Jolt`, `Canvas`, `Audio`, `Material`, `Terrain`, `VFX`, `Camera Orchestration` y conexiones especializadas siguen sin contrato completo de animación/autoridad para todos sus campos; no se muestran llaves falsas.

| Componente | Línea | Etiqueta visible (aproximada) | Canal llave | Ámbito inicial | Estado |
|---|---:|---|---|---|---|
| `Inspector.vue` | 283 | Visible | `visible` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 284 | DontDestroyOnLoad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 293 | Posición | `position` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 294 | Rotación ° | `rotation` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 295 | {{ obj.type === 'primitive' ? 'Tamaño' : 'Escala' }} | `scale` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 296 | Escala × | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 304 | Recipiente abierto | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 306 | Forma interior | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 307 | Interior (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 308 | Líquido | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 311 | Volumen inicial (m³) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 312 | Caudal de salida | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 320 | Combustible | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 322 | Ignición inicial | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 323 | Humedad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 324 | Temperatura de ignición (K) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 334 | Masa (kg) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 335 | Escala gravedad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 336 | Amortiguación lineal | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 337 | Amortiguación angular | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 338 | Puede dormir | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 340 | Rozamiento | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 341 | Rebote | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 349 | Velocidad (m/s) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 350 | Pendiente máxima (°) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 351 | Altura escalón (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 352 | Snap suelo (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 353 | Gravedad (m/s²) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 354 | Masa (kg) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 361 | Monitoring | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 362 | Monitorable | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 368 | Forma | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 372 | Autoajuste a geometría | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 373 | Tamaño (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 379 | Malla de origen | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 387 | Radio (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 388 | Altura total (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 390 | Desactivada | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 399 | Recibe cortes | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 423 | Malla objetivo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 427 | Textura | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 437 | Ancho / Alto / Profundidad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 438 | Opacidad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 475 | Recurso | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 485 | Activo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 486 | Semilla | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 495 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 496 | Sombra | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 497 | Influencia del viento | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 509 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 518 | Sombra | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 519 | Decoración estática (batch) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 520 | GI | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 523 | Escala lightmap | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 533 | Texto | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 534 | Fuente | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 537 | Alineación | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 540 | Altura letra | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 541 | Profundidad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 542 | Bisel | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 543 | Interlineado | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 551 | Emite luz | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 553 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 554 | Brillo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 555 | Forma de luz | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 559 | Energía luz | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 560 | Rango | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 561 | Ángulo ° | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 571 | Escalones | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 572 | Giro ° | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 573 | Laterales | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 575 | Altura lateral (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 576 | Grosor lateral (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 588 | Volumen | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 597 | Recibe cortes | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 606 | Geometría vinculada | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 617 | Tipo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 623 | Color | `light.color` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 624 | Energía | `light.energy` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 625 | Rango | `light.range` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 626 | Ancho (m) | `light.areaWidth` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 627 | Alto (m) | `light.areaHeight` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 629 | Ángulo ° | `light.spotAngle` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 630 | Penumbra | `light.penumbra` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 632 | Lensflare | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 634 | Tamaño flare (px) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 635 | Intensidad flare | `light.flareIntensity` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 639 | Temperatura K | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 641 | Modo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 647 | Sombras | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 649 | Resolución | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 652 | Sesgo | `light.shadowBias` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 653 | Sesgo normal | `light.shadowNormalBias` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 654 | Distancia (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 656 | Volumétrica | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 657 | Intensidad vol. | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 659 | Animación | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 666 | Velocidad | `light.speed` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 667 | Intensidad fx | `light.amount` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 676 | Etiqueta | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 685 | Uso | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 692 | Recurso UI | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 699 |  | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 703 | Resolución | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 706 | Capa | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 707 | Visible al iniciar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 708 | Recibe clics | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 709 | Modal | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 717 | Cámara principal | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 719 | FOV ° | `camera.fov` | Inspector de nodo | LLAVE DECLARADA · RUNTIME NO CERTIFICADO |
| `Inspector.vue` | 726 | Cámara objetivo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 732 | Activado | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 733 | Reproducir al iniciar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 734 | Bucle | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 735 | Patrón | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 739 | Animación | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 745 | Desplazamiento XYZ (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 746 | Rotación XYZ (°) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 747 | Frecuencia (Hz) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 749 | Frecuencia XYZ · desplazamiento (×) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 750 | Frecuencia XYZ · rotación (×) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 751 | Fase XYZ · desplazamiento (°) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 752 | Fase XYZ · rotación (°) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 753 | Duración del impulso (s, 0 = automático) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 755 | Blend In (s) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 756 | Blend Out (s) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 764 | Tipo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 767 | Database | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 771 | Recogida | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 775 | Slot | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 778 | Enemigo objetivo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 782 | Alcance (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 783 | Indicador | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 793 | Páginas | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 794 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 802 | Clip | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 816 | Salida | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 819 | Tipo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 823 | Silenciar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 824 | Al empezar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 825 | Bucle | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 826 | Volumen | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 827 | Tono | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 828 | Retardo (s) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 831 | Distancia mín. | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 832 | Distancia máx. | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 833 | Atenuación | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 836 | Cono interior ° | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 837 | Cono exterior ° | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 838 | Volumen fuera | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 839 | HRTF | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 840 | Oclusión | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 850 | Especie | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 859 | Etiqueta | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 860 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 862 | Al entrar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 863 | Al salir | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 864 | Mirada | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 866 | Alcance (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 867 | Al mirar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 868 | Al dejar de mirar | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 878 | Activo | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 879 | Forma | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 881 | Prioridad | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 882 | Peso | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 883 | Distancia de mezcla (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 884 | Transición (s) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 885 | Color de edición | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 893 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 894 | Intercambio · {{ (obj.props.exchange ?? 0).toFixed(2) }} | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 902 | Celda (m) | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 903 | Radio agente | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 904 | Altura agente | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 905 | Pendiente máx. ° | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 906 | Escalón máx. | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 907 | Capas | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `Inspector.vue` | 908 | Color | `—` | Inspector de nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 88 | Recurso | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 103 | Albedo | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 104 | {{ f.label }} | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 114 | Participa | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 115 | Retención (mm) | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 116 | Escurrimiento (m/s) | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 120 | Habilitado | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 121 | Superficie | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 122 | Clip {{ i+1 }} | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 130 | Volumen | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 131 | Tono aleatorio | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 132 | Máx./segundo | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 135 | {{ f.label }} | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSection.vue` | 138 | Color tela | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSurfaceDetail.vue` | 32 | Modo | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSurfaceDetail.vue` | 38 | Imagen | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSurfaceDetail.vue` | 47 | Intensidad | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSurfaceDetail.vue` | 51 | Microdetalle | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialSurfaceDetail.vue` | 54 | Escala micro (m) | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialShader.vue` | 43 | Shader | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `MaterialShader.vue` | 53 | Mapeo | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 37 |  | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 38 | Lienzo en blanco | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 40 | Tamaño del píxel (m) | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 52 | X | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 53 | Y | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 58 | Mirar a la cámara | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 59 | Sin sombreado | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 60 | Visible por detrás | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 61 | Recorte de transparencia | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 63 | Capa | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 64 | Filtro | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 65 | Voltear | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `SpriteSection.vue` | 66 | Tinte | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 20 | Figura | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 23 | Radio (m) | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 27 | Tamaño X/Y/Z | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 28 | Giro X/Y/Z (°) | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 30 | Centro X/Y/Z | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 35 | Anillo X/Y/Z | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 36 | Letra X/Y/Z | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `InteractionZonesPanel.vue` | 37 | Escala | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `ProfileSlot.vue` | 19 | {{ label }} | `—` | Inspector especializado | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 88 | Nombre | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 89 | Volumen | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 90 | Volumen | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 92 | Silencio | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 93 | Bypass de efectos | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 94 | Salida{{ g.name }} | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `AudioMixerInspector.vue` | 120 | Añadir efecto= 16" :value="''" @change="addEffect($event.target.value);$event.target.value=''"> Seleccionar efecto… | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 460 | Nombre | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 476 | Nombre | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 477 | Contraído | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 482 | Nombre | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 483 | Tiempo (s) | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 488 | Bloqueada | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 491 | Nombre | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 492 | Tipo | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 493 | Silenciada | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 495 | Nodo | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 499 | Propiedad | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 500 | Interpolación | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 504 | Trayectoria | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 508 | Ruta de nodo | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 509 | Propiedad | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 517 | Inicio (s) | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 518 | Duración (s) | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 519 | Modo | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 520 | Claves fuente | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 521 | Fragmento origen | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 528 | Primera clave | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 529 | Última clave | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 530 | Desplazar (s) | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 568 | Método | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 606 | Nombre | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `TemporalResourceInspector.vue` | 607 | Tiempo (s) | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `LiquidResourceEditor.vue` | 14 | Densidad (kg/m³) | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `LiquidResourceEditor.vue` | 15 | Viscosidad relativa | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `LiquidResourceEditor.vue` | 16 | Color | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `LiquidResourceEditor.vue` | 17 | Opacidad | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `ColorPickerPanel.vue` | 19 | Color | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |
| `ColorPickerPanel.vue` | 20 | Hexadecimal | `—` | Recursos/Panel compartido; determinar vínculo a nodo | SIN DESCRIPTOR O SIN LLAVE VERIFICADA |

## Criterio de cierre todavía incumplido

Cada campo funcional de nodo necesita ID estable de propiedad, propietario de runtime, semántica temporal, lector y aplicador, restauración de snapshot, ejecución de Editor/Player y QA local. El presente inventario es el **punto de partida**, no la cobertura certificada.

## Riesgos contractuales

- `G007`: escrituras directas `object3D` aún no certificadas.
- `Jolt`: no aplicar propiedades físicas por frame sin propietario/autoridad.
- `Camera Orchestration S15`: los cambios de fuente de cámara no son FOV ni clips de propiedad.
- `Canvas .ui`: requiere integrar evaluador de controles y restauración sin recrear UI.
- Efectos materiales/audio/volúmenes: gestionar propietario único y concurrencia.
