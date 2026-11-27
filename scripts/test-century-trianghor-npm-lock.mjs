import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readlinkSync, lstatSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = new URL('../', import.meta.url)
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'))
const pkg = read('package.json')
const lock = read('package-lock.json')
const vendored = read('vendor/trianghor/package.json')

 test('el manifiesto de Century declara una única dependencia local de TriangHor', () => {
  assert.equal(pkg.dependencies.trianghor, 'file:vendor/trianghor')
  assert.equal(vendored.name, 'trianghor')
  assert.equal(vendored.version, '0.0.1')
  assert.equal(pkg.devDependencies?.trianghor, undefined)
})

test('el lockfile identifica a TriangHor como enlace local, no como paquete remoto', () => {
  assert.equal(lock.lockfileVersion, 3)
  assert.equal(lock.packages[''].dependencies.trianghor, pkg.dependencies.trianghor)
  assert.deepEqual(lock.packages['node_modules/trianghor'], {
    resolved: 'vendor/trianghor',
    link: true,
  })
  assert.equal(lock.packages['vendor/trianghor'].version, vendored.version)
})

test('la dependencia local se conserva independiente de dependencias ajenas', () => {
  assert.deepEqual(vendored.dependencies ?? {}, {})
  assert.deepEqual(vendored.devDependencies ?? {}, {})
  assert.equal(lock.packages['vendor/trianghor'].engines.node, vendored.engines.node)
  assert.equal(lock.packages['node_modules/trianghor'].integrity, undefined)
})

test('npm ci instala el enlace local sin red en un fixture con el contrato real', () => {
  const temp = mkdtempSync(join(tmpdir(), 'trianghor-npm-ci-'))
  try {
    mkdirSync(join(temp, 'vendor', 'trianghor'), { recursive: true })
    writeFileSync(join(temp, 'vendor', 'trianghor', 'package.json'), JSON.stringify(vendored))
    writeFileSync(join(temp, 'package.json'), JSON.stringify({
      name: 'trianghor-install-check',
      version: '0.0.0',
      private: true,
      dependencies: { trianghor: pkg.dependencies.trianghor },
    }))
    writeFileSync(join(temp, 'package-lock.json'), JSON.stringify({
      name: 'trianghor-install-check',
      version: '0.0.0',
      lockfileVersion: lock.lockfileVersion,
      requires: true,
      packages: {
        '': {
          name: 'trianghor-install-check',
          version: '0.0.0',
          dependencies: { trianghor: pkg.dependencies.trianghor },
        },
        'node_modules/trianghor': lock.packages['node_modules/trianghor'],
        'vendor/trianghor': lock.packages['vendor/trianghor'],
      },
    }))
    const result = spawnSync('npm', ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: temp, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(lstatSync(join(temp, 'node_modules', 'trianghor')).isSymbolicLink(), true)
    assert.equal(readlinkSync(join(temp, 'node_modules', 'trianghor')), '../vendor/trianghor')
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
