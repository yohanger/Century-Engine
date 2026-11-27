# LF-AUDIO-MIXER-FADER-GAIN-S14-G001-INTEGRAL_CORR-001

**Estado:** IMPLEMENTADO; Node focal PASS; Chromium CDP aislado PASS; Electron y build del proyecto NO VERIFICADOS; QA local pendiente; NO CERRADO.

## Autorización

«Listo. LF-AUDIO-MIXER-FADER-GAIN-S14-G001-INTEGRAL_CORR-001 autoriza comenzar» — 2026-11-09.

## Observación del usuario

Node S14-G001: 17/17 PASS. Electron: WebGL2, montaje, geometría y altura 120 px de los siete faders PASS. La aserción `Arrastrar Master genera cambios de valor reales` falló porque el array de eventos `input` fue `[-1]`, sin valores intermedios. El resto de pruebas Electron no se ejecutó.

## Auditoría y causa raíz demostrada

En `scripts/fixtures/audio/mixer-fader-s14-g001.html`, el generador `move()` enviaba `mouseMoved` con `buttons:1` y `button:'none'` durante el arrastre. `scripts/qa-electron-webgl.cjs` transmite esos parámetros directamente a `Input.dispatchMouseEvent` mediante el depurador CDP.

La prueba diferencial en Chromium 144 reprodujo exactamente el error con un `<input type="range">` vertical de igual altura y estilos equivalentes:

- **Antes:** `mouseMoved(button=none, buttons=1)` → eventos `[-1]`.
- **Después:** `mouseMoved(button=left, buttons=1)` → eventos `[-27, -59, -1]`.

Esto demuestra un defecto de protocolo de la fixture. El diagnóstico original sobre combinación de estilos del fader no fue confirmado como causa del fallo Electron; no se modificó producción.

## Corrección técnica

Se actualizan los tres movimientos **mientras el botón está pulsado** (intermedio, final y retorno opcional) a `button:'left'`, conservando `buttons:1`.

- Movimiento inicial sin pulsar: `mouseMoved(button:'none',buttons:0)`.
- Pulsación: `mousePressed(button:'left',buttons:1)`.
- Arrastre: `mouseMoved(button:'left',buttons:1)`.
- Liberación: `mouseReleased(button:'left',buttons:0)`.

No se reemplazó el runner, no se enviaron eventos sintéticos `dispatchEvent` y no se alteraron AudioMixer.vue, AudioEngine, Inspector, FX, snapshots, persistencia, Player ni escenas.

## Regresiones y aceptación

Se añadieron nueve pruebas Node focales para validar los pasos, el retorno del Master, los tres buses, el protocolo efectivo del runner y la conservación de las comprobaciones posteriores. La batería focal completa del Mixer suma 26 PASS.

Siete pruebas históricas adicionales se ejecutaron sobre el baseline previo y el corregido: ambos 80 PASS, 8 SKIP y 2 FAIL históricos AMI-15/17. La batería completa NO es PASS.

El análisis Chromium CDP es evidencia auxiliar, no Electron real. Electron y `npm run build` no se ejecutaron aquí por falta de node_modules/Vite.

**No cerrar** sin Electron PASS, compilación Editor y Player, comprobación de faders en el Editor y aprobación del usuario.
