# QA — LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-002

## Evidencia de entrada

Capturas del usuario de `Probando`: sol puntual claramente visible, niebla ausente al mirar arriba/abajo, horizonte claro en tormenta; escena con `Clima y atmósfera` activado, `Tormenta`, intensidad 1, nubes clásicas. La causa raíz de cada síntoma se sustenta en rutas de render auditadas; la captura por sí sola no distingue la contribución precisa de cada pase.

## Ejecutado durante implementación

| Verificación | Resultado |
| --- | --- |
| Node `scripts/test-weather-tornado-natural-s04-corr002.mjs` | 12/12 PASS |
| Node todas las suites `test-weather-tornado-*.mjs` sin `*electron*`, más cloudfield/windfield | 269/269 PASS |
| `node --check` de archivos JS de producción | PASS |
| Electron/WebGL con shader real | NO VERIFICADO (Vite/Electron no instalados) |
| `npm run build` (Editor y Player) | NO VERIFICADO |
| Play y Player exportado | NO VERIFICADO para este correctivo |
| Tiempo de frame / GPU N5030 | NO VERIFICADO |

## Comandos locales (desde SOURCE_BASELINE CORR-002)

Si faltan dependencias, instalar una única vez con `npm ci`.

```bash
node --test scripts/test-weather-tornado-natural-s04-corr002.mjs
node --test scripts/test-weather-tornado-natural-electron-s04-corr002.mjs
node --test scripts/test-weather-tornado-natural-electron-s04-corr001.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-corr002.mjs
npm run build
npm run electron
```

Esperado: 12 PASS Node, 1 PASS Electron CORR-002 con **al menos 29 verificaciones internas**, 1 PASS de cada runner de regresión anterior, compilación Editor/Player sin errores. Los avisos existentes de chunks/importe estático-dinámico no son prueba de fallo por sí solos.

## QA visual obligatorio

1. En la escena `Probando`, activar Tormenta intensidad 1, nubes clásicas, modo de iluminación celestial Manual; mirar el disco solar y comparar con CORR-001 bajo el mismo horario/encuadre.
2. Rotar la cámara desde horizonte hacia arriba y hacia abajo. La niebla de tormenta debe permanecer en la bóveda; no debe producirse una transición clara u horizonte blanco. Confirmar que la niebla sobre geometría sigue funcionando.
3. Repetir con cielo físico, y con la opción de niebla física + compositor activo. No puede aparecer niebla doble, ni apagarse al alternar compositor.
4. Cambiar a Despejado y a otros climas. La cubierta severa no debe permanecer cuando no existe la densidad meteorológica correspondiente; la luz direccional debe funcionar en cada modo.
5. Verificar tornado visible y sin rectángulo S02 CORR-002, nube madre, polvo S03 y contacto/cono CORR-001.
6. Ejecutar Player exportado independiente y registrar frame time si está disponible.

**Evidencia a devolver:** salidas Node/Electron/build; capturas en tres direcciones con tormenta; captura sin tormenta; si persiste defecto, vídeo continuo y perfil de render.

**Cierre:** pendiente de tu QA local explícito, no inferido por las pruebas automatizadas.
