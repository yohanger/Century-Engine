// LF-EDITOR-DISTRIBUTION-CORR-001, revisión de robustez.
// Prepara los iconos aprobados SOLO cuando faltan o son inválidos. No sobrescribe
// iconos personalizados válidos y no sustituye la verificación de distribución.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateDistributionIcons } from './make-icon.mjs'
import { verifyEditorDistribution } from './verify-editor-distribution.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Comprueba los recursos y repara ausencias antes de llamar a electron-builder. */
export function prepareEditorDistribution(root = projectRoot) {
  let errors = verifyEditorDistribution(root, 'source')
  const damagedIcons = errors.filter(message => /build\/icon(?:s\/|\.)/.test(message))
  let restored = false
  if (damagedIcons.length) {
    generateDistributionIcons(root)
    restored = true
    errors = verifyEditorDistribution(root, 'source')
  }
  if (errors.length) {
    const error = new Error(`No se puede empaquetar Century:\n${errors.map(e => `- ${e}`).join('\n')}`)
    error.details = errors
    throw error
  }
  return { restored }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = prepareEditorDistribution()
    console.log(result.restored
      ? 'Distribución Century: iconos ausentes o inválidos regenerados y verificados.'
      : 'Distribución Century: iconos existentes verificados, sin sobrescribirlos.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
