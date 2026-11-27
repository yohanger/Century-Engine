# LF-DB-S04-G001 — QA de animaciones y presentación opcional

**Sprint:** S04 completo, un único Gate. **Estado:** implementado, pendiente de QA en el equipo del usuario.
**Baseline:** `LevelForge_S03_APPROVED_SOURCE_BASELINE.zip`.

## Objetivo

Un objeto 3D o un arma debe poder ejecutar su acción declarativa de Database **con o sin animación y sonido**. Se reutilizan el comando «Objeto 3D de Database» (S02), «Arma equipada 3D» (S03), el reproductor `animationPlay()` y `audio.play()`; no se obliga a escribir scripts ni se añaden señales nativas.

## Preparación en el editor

1. En **Database → Objetos**, crea un objeto consumible que recupere HP. Selecciona su modelo 3D. En **Presentación opcional**, deja inicialmente «Animación al usar» y «Sonido al usar» vacíos.
2. Crea un evento con gráfico **Objeto (base de datos)** asociado al registro anterior. En sus comandos usa **Objeto 3D de Database → Recoger**. En un evento común activado mediante entrada, configura **Objeto 3D de Database → Usar** y referencia el evento del objeto por el campo «Evento del objeto».
3. En **Database → Habilidades**, crea una acción de prueba con coste de MP y daño a enemigo. En **Database → Armas**, asigna esa habilidad a **Acción del arma (habilidad)**. Deja vacíos «Animación de la acción» y «Sonido de la acción».
4. En un evento con gráfico **Arma (base de datos)** utiliza «Arma equipada 3D → Equipar». En un evento común con una acción de entrada utiliza «Arma equipada 3D → Ejecutar acción del arma» y selecciona el enemigo de prueba. Verifica que la habilidad se ejecuta y consume MP.
5. Configura después una animación existente del proyecto para «Animación al usar»/«Animación de la acción». Puedes usar un clip creado en el editor o un clip embebido en el modelo importado de un evento. Asigna también un audio importado de Assets/Audio.
6. Repite los mismos usos; después deja solo sonido, solo animación y ambos campos vacíos. Comprueba que los resultados de Database no cambian por la presencia o ausencia de presentación.

## Casos manuales (sin scripts)

- [ ] **S04-VIS-01:** objeto consumible sin clips cura/consume inmediatamente y retira su modelo de la mano.
- [ ] **S04-VIS-02:** objeto con animación reproduce el clip en su evento de Database; no retira el modelo hasta que la animación termina. El efecto de Database se aplica exactamente una vez.
- [ ] **S04-VIS-03:** objeto con sonido sin animación se usa inmediatamente, reproduce SFX y no duplica inventario.
- [ ] **S04-VIS-04:** objeto no consumible con clip reproduce su animación y permanece en la mano.
- [ ] **S04-VIS-05:** arma sin clips aplica la habilidad, consume el MP previsto y mantiene el modelo en la mano.
- [ ] **S04-VIS-06:** arma con animación y sonido reproduce ambos, aplica daño una sola vez y conserva su estado equipado.
- [ ] **S04-VIS-07:** ataque rechazado (MP insuficiente, falta de enemigo, habilidad bloqueada) no dispara animación ni audio ni cambia inventario/HP/MP.
- [ ] **S04-VIS-08:** elige temporalmente un nombre de clip inexistente en un proyecto de prueba: una presentación errónea no revierte ni duplica el resultado válido. Debe informar en el registro cuando exista `host.log`.
- [ ] **S04-VIS-09:** modelo importado GLB/GLTF con animación embebida y colocado mediante gráfico de evento de Database: se ejecuta el clip seleccionado.
- [ ] **S04-VIS-10:** guardar/cargar una partida conserva inventario, equipamiento y lógica del modelo. No guarda progreso parcial de una animación (no forma parte del contrato).
- [ ] **S04-VIS-11:** repetir en Player exportado. Comprobar además el AppImage del editor si se genera.

## QA automatizado y compilación

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
```

Resultado esperado del runner: **115 tests / 115 PASS / 0 FAIL / 0 TODO**. Incluye 101 pruebas anteriores y 14 casos S04.

Las pruebas de Node utilizan hosts simulados y no reproducen archivos de audio ni dibujan modelos reales. El `npm run build` y las verificaciones visuales de editor, Player y AppImage son evidencias separadas que debe aportar el usuario. **No cerrar S04 por el resultado de Node solamente.**

## Compatibilidad y límites

- Los registros anteriores sin `actionAnimation` o `actionSound` usan cadenas vacías y conservan sus efectos, consumo y coste de MP.
- Una animación sin clip válido o un sonido fallido no cancela una acción ya validada. Se intenta informar del problema sin bloquear la lógica.
- El consumible con animación aguarda el fin del clip para ocultar su modelo. Sin animación, no aguarda nada. Los sonidos no retrasan la acción.
- El View Model de un objeto o arma sigue vinculado al evento de su escena, igual que S02/S03; no se ha implementado transporte físico entre escenas.
- No se ha creado otro reproductor de animaciones/audio, otro inventario, temporizadores globales ni señales nativas de recoger/equipar/soltar.
- Una animación seleccionada de otro modelo podría no existir en el modelo del evento. El usuario debe elegir un clip compatible con ese modelo o un clip del proyecto.

## Estado al entregar

**IMPLEMENTADO — PENDIENTE QA LOCAL Y APROBACIÓN DEL USUARIO.** S05 continúa sin autorización.
