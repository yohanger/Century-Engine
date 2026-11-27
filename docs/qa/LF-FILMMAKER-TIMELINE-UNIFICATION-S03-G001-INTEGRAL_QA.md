# QA local — FilmMaker S03 Timeline unificado

**Estado:** PENDIENTE DE QA ELECTRON Y APROBACIÓN. No confundir pruebas de fuente con compilación o QA visual.

Desde la raíz de LevelForge actualizada mediante CHANGE, donde está `package.json`:

```bash
node --test scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs
node --test scripts/test-filmmaker-anim-s01-g001.mjs scripts/test-filmmaker-camera-direction-s02-g001-integral.mjs scripts/test-timeline-ux-integration-s04-g004.mjs
npm run filmmaker -- --build
```

**Salida esperada:** todas las pruebas ejecutables PASS, 0 FAIL; Vite completa la compilación sin error. Ejecutar en Electron embebido, no navegador externo.

1. Abrir una escena `.lfproj` como nueva película. La cámara estructural debe existir, pero la Timeline debe mostrar `Película sin pistas` y ninguna toma/clip/efecto; sin contenido demo.
2. Abrir menú `＋ Pista`; añadir un plano únicamente tras grabar una pasada real. Verificar que aparece y puede seleccionarse, duplicarse desde clic derecho, dividirse y eliminarse sin alterar el pase fuente.
3. Activar `Animar`, arrastrar **un** nodo de Jerarquía al Timeline, elegir propiedad por ID. Insertar claves; probar arrastre, duplicación Ctrl+D, interpolaciones incluida Bézier, cambios de preset, Undo/Redo de claves. Confirmar que la escena no recibe modificaciones persistentes por la mera previsualización.
4. Añadir audio real desde Assets; comprobar posición, duplicación, recortes, fundidos y ausencia de duplicación del recurso Assets. Probar Zoom, Ajustar, Home/End, snap y desplazamiento.
5. Comprobar que siguen funcionando física horneada, actores, cámaras, transiciones, color y audio del montaje; probar redimensionamiento y modo compacto.
6. Guardar `.nfm`, cerrar FilmMaker, reabrir y comprobar pistas, claves, clips, IDs, cámaras y duración. **No se crean pistas automáticamente al reabrir.**
7. Exportar una película con montaje real y abrir/importar en Cinematics; verificar procedencia, Timeline y Reproducir en Juego. Si falla, atribuir la incidencia a productor/exportador/importador según evidencia; S07 queda con QA independiente.
8. Abrir Timeline de LevelForge y comprobar sus funciones originales de creación, zoom, claves, menús y jerarquía.

**Evidencia a devolver:** log de comandos, capturas de Timeline FilmMaker vacía y con una película real, resultado de guardado/reapertura, prueba de integración Cinematics y cualquier error. QA visual del usuario obligatorio antes de cerrar.

**Pendiente contractual:** pistas de métodos/comandos de gameplay NO se habilitan para FilmMaker sin contrato de seguridad de autoría/evaluación. La ausencia de esa función no debe disfrazarse como PASS del Sprint completo.
