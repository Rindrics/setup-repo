import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ejs from 'ejs';
import type { InitOptions } from '../types';
import { getLatestVersions, getNpmUsername } from '../utils/npm';

const TEMPLATES_DIR = path.join(import.meta.dir, '../templates');

const DEV_DEPENDENCIES = [
  '@biomejs/biome',
  '@commitlint/cli',
  '@commitlint/config-conventional',
  'bun-types',
  'husky',
  'typescript',
];

export interface GeneratedFile {
  path: string;
  content: string;
}

export async function loadTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const fullPath = path.join(TEMPLATES_DIR, templatePath);
  const template = await fs.readFile(fullPath, 'utf-8');
  return ejs.render(template, data);
}

export async function generatePackageJson(
  options: InitOptions,
): Promise<GeneratedFile> {
  // Fetch latest versions and npm username in parallel
  const [versions, author] = await Promise.all([
    getLatestVersions(DEV_DEPENDENCIES),
    getNpmUsername(),
  ]);

  const content = await loadTemplate('typescript/package.json.ejs', {
    name: options.projectName,
    isDevcode: options.isDevcode,
    author: author ?? '',
    versions,
  });

  return {
    path: 'package.json',
    content,
  };
}

export async function writeGeneratedFiles(
  targetDir: string,
  files: GeneratedFile[],
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });

  for (const file of files) {
    const filePath = path.join(targetDir, file.path);
    const fileDir = path.dirname(filePath);

    if (fileDir !== targetDir) {
      await fs.mkdir(fileDir, { recursive: true });
    }

    await fs.writeFile(filePath, file.content, 'utf-8');
  }
}

export async function generateProject(options: InitOptions): Promise<void> {
  const files: GeneratedFile[] = [await generatePackageJson(options)];

  await writeGeneratedFiles(options.projectName, files);
}
