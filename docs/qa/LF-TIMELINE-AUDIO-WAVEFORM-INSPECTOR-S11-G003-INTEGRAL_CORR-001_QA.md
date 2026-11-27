# Corrección de QA de forma de onda · S11-G003 CORR-001

Gate `LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL_CORR-001`

Autorización literal el 7 de noviembre de 2026. «Listo. LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL_CORR-001 autoriza comenzar».

Base de la corrección. `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_SOURCE_BASELINE.zip`, entrega de G003 en QA. G002 se conserva como último Gate aprobado.

## Diagnóstico

- **Observado en QA local.** El usuario obtuvo 35 PASS de Node y 10 comprobaciones internas positivas de Electron. La fixture falló en la espera «Continúan voces y comando». Después interrumpió la compilación y el arranque del Editor.
- **Defecto reproducido en la fixture anterior.** La salida simulada contaba cualquier ID recibido. El audio corrupto sumaba una tercera voz y la condición de exactamente dos podía perderse si se observaba fuera de su intervalo. La espera también dependía del avance real de fotogramas en una ventana oculta. El registro de usuario no permite identificar qué condición venció en esa ejecución.
- **Corrección.** La fixture inyecta un reloj de 50 ms por paso en el transporte existente y avanza hasta 0.8 s. La salida simulada acepta el ID del WAV válido. Las comprobaciones separan inicio, subtítulo, selección efectiva, reloj, voces, pausas y Stop. Ante un fallo se registran tiempo, cabezal, estado de Play, selección, subtítulo, fotogramas pendientes, voces y avisos.
- **Alcance.** Dos archivos de QA ejecutables, documentación, evidencia y ledger. La comparación de fuentes verifica identidad byte a byte del código del motor, Editor y Player.

## Aplicación y QA local

Compara los archivos de `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR001_CHANGE.zip` con tu copia en uso antes de reemplazar. En la raíz donde está `package.json`, aplica el ZIP en las mismas rutas y conserva tus cambios locales, proyectos, escenas y Assets. La alternativa aislada es extraer `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR001_SOURCE_BASELINE.zip` en una carpeta nueva e instalar dependencias allí.

Ejecuta primero la fixture corregida en Electron embebido.

```bash
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs
```

Salida esperada. **1 prueba PASS y 18 comprobaciones internas**. Si falla, devuelve la salida completa con el bloque `observed`.

Tras el PASS, ejecuta la compilación y abre el Editor.

```bash
npm run build && npm run electron
```

Repite el caso con audio real y un comando seguro de texto. Selecciona distintos clips durante Play y comprueba que el cabezal avanza, el sonido continúa y el comando aparece. La fixture usa un WAV real para la onda y voces simuladas para el transporte. La escucha real se verifica en el Editor.

## Evidencia de generación

- Node con las tres suites focales y de continuidad. **35 PASS**.
- Se ejecutó en Node la sección de transporte de la fixture con el reloj corregido, el Runner real y selección contextual por API. **9 comprobaciones PASS**, incluido el inicio de Play. La comprobación de gestos DOM queda para Electron.
- `npm run build` compiló Editor y Player.
- Electron se detuvo antes de cargar la fixture por falta de servidor gráfico. **QA Electron local pendiente. Gate abierto.**

Logs con prefijo `LF_S11_G003_CORR001_` en `docs/qa/evidence/`.
