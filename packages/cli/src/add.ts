import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

import chalk from 'chalk'
import { pascalCase } from 'change-case'
import { copy, ensureDir } from 'fs-extra'
import prompts from 'prompts'

const home = homedir()
const tamaguiDir = path.join(home, '.tamagui')

export const generatedPackageTypes = ['font', 'icon'] as const
export const installGeneratedPackage = async (type: string, packagesPath?: string) => {
  packagesPath = packagesPath || 'packages'
  if (!generatedPackageTypes.includes(type as (typeof generatedPackageTypes)[number])) {
    throw new Error(
      `${
        type ? `Type "${type}" is Not supported.` : `No type provided.`
      } Supported types: ${generatedPackageTypes.join(', ')}`
    )
  }
  const repoName = type === 'font' ? 'tamagui-google-fonts' : 'tamagui-iconify'
  console.log(`Setting up ${chalk.blueBright(tamaguiDir)}...`)

  await ensureDir(tamaguiDir)
  const tempDir = path.join(tamaguiDir, repoName)
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true })
  }
  try {
    execSync(
      `cd ${tamaguiDir} &&
      git clone -n --depth=1 --branch generated --filter=tree:0 https://github.com/tamagui/${repoName}
      cd ${repoName}
      git sparse-checkout set --no-cone meta
      git checkout`,
      {
        stdio: 'inherit',
      }
    )
  } catch (error) {
    throw new Error(
      `You don't have access to Tamagui ${
        type === 'font' ? 'fonts' : 'icons'
      }. Check 🥡 Tamagui Takeout (https://tamagui.dev/takeout) for more info.`
    )
  }

  const meta = JSON.parse(
    await readFile(path.join(tamaguiDir, repoName, `meta`, `data.json`)).then((r) =>
      r.toString()
    )
  )

  const result = await prompts({
    name: 'packageName',
    type: 'autocomplete',
    message: `Pick a ${type}:`,

    choices: Object.entries<any>(meta).map(([slug, data]) => ({
      title:
        type === 'font'
          ? `${slug}: ${data.weights.length} weights, ${data.styles.length} styles, ${
              data.subsets.length
            } subsets (https://fonts.google.com/specimen/${pascalCase(slug)})`
          : `${data.name}: ${data.total} icons, ${data.license.title} license (${data.author.url})`,
      value: slug,
    })),
  })

  const packageName = `${type}-${result.packageName}`
  const packageDir = path.join(tempDir, 'packages', packageName)

  execSync(
    `cd ${tempDir} &&
    git sparse-checkout set --no-cone packages/${packageName}
    git checkout`
  )
  const finalDir = path.join(packagesPath, packageName)
  await ensureDir(packagesPath)
  await copy(packageDir, finalDir)
  console.log(`Created the package under ${finalDir}`)
}
