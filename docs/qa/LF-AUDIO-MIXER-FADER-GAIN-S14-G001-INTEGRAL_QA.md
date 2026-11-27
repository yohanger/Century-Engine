# QA obligatorio — LF-AUDIO-MIXER-FADER-GAIN-S14-G001-INTEGRAL

## Resultado de preparación

- Node focal: **17 PASS / 0 FAIL**.
- Regresión Mixer/Inspector/Engine/routing: **97 PASS / 8 SKIP / 2 FAIL**. AMI-15 y AMI-17 se reproducen idénticos en el SOURCE_BASELINE anterior; **suite ampliada NO PASS total**.
- Electron principal: **NO VERIFICADO** — requiere Vite y Electron instalados.
- Build Editor + Player: **NO VERIFICADO** — Vite ausente del entorno de preparación.
- QA visual/sonoro del usuario: **PENDIENTE**.

## Instalación

Partir del proyecto activo que ya contiene G008-G003 CORR-002; trabajar desde la raíz con `package.json`. Respaldar `src/components/AudioMixer.vue` y `docs/qa/LevelForge_DB_Ledger.xlsx`; comparar cambios locales antes de reemplazarlos y aplicar CHANGE únicamente si no hay diferencias por integrar. No extraer SOURCE_BASELINE encima de proyecto activo.

## Comandos

```bash
node --test scripts/test-audio-mixer-fader-gain-s14-g001.mjs
node --test scripts/test-audio-mixer-fader-gain-s14-g001-electron.mjs
node --test scripts/test-audio-mixer-inspector-electron-s02-g001.mjs
node --test scripts/test-timeline-audio-mixer-routing-s11-g004-electron.mjs
npm run build
npm run electron
```

Esperado: 17 PASS focales. Fixture Electron S14: **1 PASS y 30 o más verificaciones internas**, con movimiento nativo (CDP `Input.dispatchMouseEvent`) de Master, Música y SFX. Los tests de historial y el build deben terminar correctamente. No confundir Node PASS con fader usable.

## QA manual en Editor Electron

1. Abrir Audio Mixer con Master y las pistas visibles. Arrastrar de arriba abajo y viceversa de forma continua; observar valores intermedios (-10, -20, -30, etc.) sin saltar automáticamente a `-∞`.
2. Repetir en Música, SFX, Voz, Ambiente y UI; desplazarse horizontalmente al grupo correspondiente. Probar además un grupo personalizado.
3. Verificar +0.0 dB y `-∞`: solo el mínimo -80 dB produce ganancia cero; la escucha debe cambiar gradualmente.
4. Doble clic restaura 0 dB. Editar texto `-∞`, `-6,5`, `-24`; introducir texto inválido y comprobar que **no** cambia el volumen.
5. Cambiar volumen en Inspector y observar actualización de fader/texto; cargar y guardar un snapshot y comprobar restauración.
6. Verificar Mute/Solo/Bypass, cadena FX y canales de Player sin regresiones. Guardar/reabrir un proyecto con cambios en volumen.

## Evidencia requerida

Salidas completas de Node, las pruebas Electron, `npm run build`, y comentario/capturas de QA local y escucha. **Estado pendiente hasta evidencia y aprobación del usuario.**
