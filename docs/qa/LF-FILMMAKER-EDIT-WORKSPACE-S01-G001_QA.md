# QA USUARIO — LF-FILMMAKER-EDIT-WORKSPACE-S01-G001

**Estado histórico al emitir QA:** PENDIENTE. **Resultado posterior (2026-11-05):** 9/9 pruebas específicas PASS y Vite build PASS aportados por usuario; aprobación expresa «Aprobado.»; Gate G001 CERRADO. Ver documento `_CLOSE.md` y evidencia adjunta. No se recibieron capturas individuales de cada verificación.
**Dónde:** raíz del proyecto LevelForge S03 existente que contiene `package.json` y ya recibió los CHANGE acumulados. **Aplicar únicamente CHANGE de este Gate**, comparando y respaldando los archivos locales que se reemplazarán; no descargar SOURCE_BASELINE completo para una corrección incremental.

## Pruebas en Electron real

1. Cerrar las instancias antiguas de FilmMaker/LevelForge. Abrir terminal **en la raíz existente** del proyecto y ejecutar:
   `node --test scripts/test-filmmaker-edit-workspace-s01-g001.mjs`
   `npm run filmmaker -- --build`
   Esperado: **9 tests PASS** en la suite específica; Vite BUILD PASS y FilmMaker abierto con escenario/película cargada.
2. **El icono PC/Laptop** en la barra, junto a Render/Vista, debe estar dibujado y alternar; el fallo visual del Gate anterior sigue pendiente de comprobación por usuario.
3. En FilmMaker, comprobar que la Timeline inferior es más alta inicialmente y que el viewport conserva un área de trabajo. Arrastrar su divisor hacia arriba y abajo; el visor y su encuadre deben adaptarse sin estiramiento ni congelación.
4. Pulsar **Ampliar**. Esperado: la Timeline ocupa más ancho, las barras laterales desaparecen temporalmente sin cerrar sus componentes y queda una franja de viewport visible de al menos ~205 px cuando la ventana sea suficientemente alta. Deben permanecer accesibles las pistas, regla, zoom y desplazamiento horizontal.
5. Pulsar **Restaurar**. Esperado: los paneles y su estado anterior reaparecen; la altura original ajustada con el divisor vuelve sin pérdida de selección ni estado de montaje.
6. Probar Arriba/Abajo con el divisor horizontal enfocado (teclado). Debe ajustarse la altura respetando límites. Probar los divisores laterales a anchuras de ventana 1280, ~1024, 900, y ventana de altura reducida. Las pestañas, el viewport y el timeline deben seguir accesibles sin solapamiento.
7. Cambiar a Assets y Mezclador, volver a Timeline. Verificar que el modo Ampliar se desactiva al salir de Timeline y que no pierde audio/estado del montaje; abrir Inspector, Color, Cámara y Actor en el espacio normal.
8. Reproducir, seleccionar, desplazar, recortar y buscar en una película **de prueba** (no sobrescribir tomas originales). Guardar `.nfm`, cerrar FilmMaker, volver a abrir y comprobar pistas e información. **El comportamiento de duración avanzada de capas pertenece a G002**, no es criterio de G001.
9. Confirmar que la cámara PC/Laptop y el Player no presentan regresiones de navegación; no realizar QA Android porque está pausado.

## Evidencias solicitadas

- Captura del espacio normal y del modo Ampliar; captura del icono PC/Laptop visible.
- Informe de si el divisor responde con ratón y teclado, y si se restauran los paneles.
- Registro del comando `node --test` y final de `npm run filmmaker -- --build` (o error exacto).
- Prueba de una película .nfm guardada y reabierta sin pérdida de pistas.

**No llamar QA LOCAL PASS o GATE CERRADO hasta que el usuario confirme y exista evidencia.** No ejecutar `npm audit fix`, no instalar otra versión de Android, no borrar proyectos ni escenas.
