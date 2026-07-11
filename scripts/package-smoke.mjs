import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')
const templateDir = join(rootDir, 'scripts/package-smoke')
const tempDir = mkdtempSync(join(tmpdir(), 'ydb-orm-package-smoke-'))

const run = (command, args, options = {}) => {
  execFileSync(command, args, {
    cwd: options.cwd || rootDir,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: 'inherit',
  })
}

try {
  run('npm', ['run', 'build'])

  const packOutput = execFileSync(
    'npm',
    ['pack', '--pack-destination', tempDir],
    {
      cwd: rootDir,
      encoding: 'utf8',
    },
  ).trim()
  const archiveName = packOutput.split('\n').at(-1)
  assert.ok(archiveName, 'npm pack did not return an archive name')

  const archivePath = join(tempDir, archiveName)
  const projectDir = join(tempDir, 'consumer')
  mkdirSync(projectDir)

  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: 'ydb-orm-package-smoke-consumer',
        private: true,
        type: 'module',
        scripts: {
          'smoke:mjs': 'node smoke.mjs',
          'smoke:cjs': 'node require-smoke.cjs',
        },
        dependencies: {
          'ydb-orm': `file:${archivePath}`,
        },
      },
      null,
      2,
    ),
  )

  run('npm', ['install'], { cwd: projectDir })

  copyFileSync(join(templateDir, 'smoke.mjs'), join(projectDir, 'smoke.mjs'))
  copyFileSync(
    join(templateDir, 'require-smoke.cjs'),
    join(projectDir, 'require-smoke.cjs'),
  )

  run('npm', ['run', 'smoke:mjs'], { cwd: projectDir })
  run('npm', ['run', 'smoke:cjs'], { cwd: projectDir })
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
