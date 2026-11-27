// Extiende el runner real existente con medición del puente y perfiles aislados.
process.argv.push('--bridge')
await import('./test-vscode-extension-real-s03-g001.mjs')
