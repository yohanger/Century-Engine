# QA — arranque y diagnóstico del fixture de Escena

## Evidencia local aportada

Suite `scene-inspector-professional-ux-electron`: FAIL (0/1); timeout, `readyState=complete`, `stage=null`, `checks=null`, texto `Cargando…`. Ninguno de los 19 checks acreditado.

## Verificación de entrega

- Baseline: 3947 archivos, sin diferencias.
- Node: 22/22 PASS (12 originales y 10 diagnósticas nuevas).
- Regresión comparativa: 91/95 PASS antes y después; mismos cuatro fallos históricos SCUX-04, S02-16, SCENE-05 y SCENE-09. Incluye cuatro suites de contrato del runner compartido.
- Sintaxis de ambos scripts del HTML y los dos runners: PASS.
- Electron: bloqueado antes del arranque por ausencia de Vite. 0/19 checks ejecutados aquí.
- Compilación: NO VERIFICADA.
- Defecto diagnóstico: reproducido en Node mediante errores y resultados simulados del protocolo; no equivale a un fallo real de importación reproducido en Electron.
- Causa del bloqueo original: NO VERIFICADA.

## QA local

`npm run test:suite -- scene-fixture-diagnostics`

`npm run test:suite -- scene-inspector-professional-ux-electron`

Si falla, conservar el resultado íntegro, incluida etapa, checks, diagnostics y vite. No cambiar el timeout ni asumir que es un defecto de producción. Gate parcial, no aprobado, no cerrado.
