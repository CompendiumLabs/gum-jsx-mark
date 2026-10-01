import { copyFile, mkdir, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// Include installed runtime dependency licenses, plus bundled font/data notices.
export async function licenses(root: string, dependencies: readonly string[], destination: string) {
  const packageRoot = await realpath(root)
  const seen = new Set<string>()
  async function visit(directory: string) {
    directory = await realpath(directory)
    if (seen.has(directory)) return
    seen.add(directory)
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    const output = join(destination, `${pkg.name.replaceAll('/', '__')}@${pkg.version}`)
    for (const relative of ['', 'src/fonts', 'data']) {
      const source = join(directory, relative)
      let entries
      try { entries = await readdir(source, { withFileTypes: true }) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      for (const entry of entries) {
        if (!entry.isFile() || !/(license|notice|copying|^ofl)/i.test(entry.name)) continue
        const target = join(output, relative, entry.name)
        await mkdir(dirname(target), { recursive: true })
        await copyFile(join(source, entry.name), target)
      }
    }
    for (const name of directory === packageRoot ? dependencies : Object.keys(pkg.dependencies ?? {})) {
      let current = directory
      while (true) {
        const candidate = join(current, 'node_modules', name)
        try { await stat(join(candidate, 'package.json')) }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          const parent = dirname(current)
          if (parent === current) throw new Error(`Cannot find dependency notices for ${name}`)
          current = parent
          continue
        }
        await visit(candidate)
        break
      }
    }
  }
  await visit(root)
}

