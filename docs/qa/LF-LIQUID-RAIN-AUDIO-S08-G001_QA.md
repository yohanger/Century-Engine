# QA — LF-LIQUID-RAIN-AUDIO-S08-G001

**Gate autorizado:** LF-LIQUID-RAIN-AUDIO-S08-G001.
**Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL PENDIENTE · NO CERRADO.

## Pruebas automáticas

- `npm run test:liquid-rain-audio`: **221 pruebas declaradas, 213 PASS, 0 FAIL, 8 SKIP**. Los SKIP dependen de Three.js y requieren `npm ci` local.
- Nuevas RA-01–RA-25: **25/25 PASS**: opt-in, perfiles/clips, normalización repetida, material compartido, metadata de raycast, legacy sin metadata, materiales, suelo/agua/vegetación, silencio por recursos ausentes, tasas, cuatro voces, parada, oclusión con trueno por clips y UI de autoría.
- Regresiones incluidas: audio S01/S02, corrección Audio S02, truenos, WATER S01–S07, pipeline render.
- Revisión `node --check` de módulos JS modificados: PASS.
- `npm run build`: **NO VERIFICADO** (`vite` ausente).
- `npm run docs:build`: **NO VERIFICADO** (`marked` ausente); volver a generar tras `npm ci`.

## QA local de usuario (obligatorio)

1. Comparar CHANGE con archivos locales y respaldar el ledger. Instalar solo CHANGE si no existen conflictos.
2. `npm ci`, `npm run test:liquid-rain-audio`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
3. Configurar en Escena → Clima la lluvia, activar «Impactos por superficie» y asignar clips reales a perfiles de piedra, tierra, hierba, metal y agua. Sin clips, los golpes deben permanecer silenciosos sin perder el bucle ambiental.
4. Crear un tejado de zinc (material con superficie Metal) y una losa de hormigón (Piedra). Configurar perfiles distintos en `MaterialSection` mediante Assets. Escuchar con auriculares en Play la diferenciación y el posicionamiento respecto al jugador.
5. Probar superficie compartida `.material`, material local, carretera con slot, Terrain pintado y agua visible. Comprobar que el primer impacto no se duplica en Terrain bajo techo.
6. Cambiar la intensidad de lluvia, maxRate, volumen y variación de tono. Confirmar que no hay saturación de voces ni cortes del bucle de lluvia, truenos o viento.
7. Probar bajo un techo la atenuación exterior, la oclusión por voces y la reproducción directa del impacto del tejado. Cambiar tronido procedural/clips y verificar que no desaparece la oclusión ambiental.
8. Guardar y reabrir `.lfproj`; probar Undo/Redo y la preescucha; eliminar un recurso y comprobar fallo controlado.
9. Detener Play, cambiar de escena, volver a Play y ejecutar Player exportado. Ninguna voz anterior debe quedar sonando.
10. Medir FPS y memoria con lluvia normal/intensa en hardware objetivo, comparar con S07. Verificar en PBR y PSX.

**Evidencia a devolver:** log de tests, docs/build, capturas de Clima y MaterialSection, prueba auditiva real o descripción reproducible (posiciones, clips, comportamiento), Player, FPS/RAM. La prueba Node no valida el oído ni la acústica real.

**Exclusiones:** no cambia WaterWorld, no añade líquidos en recipientes, no genera clips, no introduce un mixer o SDK nuevo. S09 cuerpos de agua, S10 recipientes y S11–S13 continúan planificados.
