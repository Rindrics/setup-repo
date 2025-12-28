import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ejs from 'ejs';
import type { InitOptions } from '../types';
import { getLatestActionVersions } from '../utils/github';
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

export class TemplateError extends Error {
  constructor(
    message: string,
    public readonly templatePath: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

export async function loadTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const resolvedTemplatesDir = path.resolve(TEMPLATES_DIR);
  const fullPath = path.resolve(TEMPLATES_DIR, templatePath);

  if (!fullPath.startsWith(resolvedTemplatesDir + path.sep)) {
    throw new TemplateError(
      `Invalid template path: "${templatePath}" resolves outside templates directory`,
      templatePath,
    );
  }

  let template: string;
  try {
    template = await fs.readFile(fullPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      throw new TemplateError(
        `Template not found: "${templatePath}"`,
        templatePath,
        fsError,
      );
    }
    throw new TemplateError(
      `Failed to read template "${templatePath}": ${fsError.message}`,
      templatePath,
      fsError,
    );
  }

  try {
    return ejs.render(template, data);
  } catch (error) {
    const renderError = error as Error;
    throw new TemplateError(
      `Failed to render template "${templatePath}": ${renderError.message}`,
      templatePath,
      renderError,
    );
  }
}

export async function generatePackageJson(
  options: InitOptions,
): Promise<GeneratedFile> {
  try {
    const [versions, detectedAuthor] = await Promise.all([
      getLatestVersions(DEV_DEPENDENCIES),
      options.author ? Promise.resolve(options.author) : getNpmUsername(),
    ]);
    const author = detectedAuthor ?? '';
    const templatePath = `${options.lang}/package.json.ejs`;
    const content = await loadTemplate(templatePath, {
      name: options.projectName,
      isDevcode: options.isDevcode,
      author,
      versions,
    });
    return { path: 'package.json', content };
  } catch (error) {
    throw new Error(
      `Failed to generate package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function generateTsconfig(
  options: InitOptions,
): Promise<GeneratedFile> {
  const content = await loadTemplate(`${options.lang}/tsconfig.json.ejs`, {});
  return { path: 'tsconfig.json', content };
}

export async function generateEntryPoint(
  options: InitOptions,
): Promise<GeneratedFile> {
  const content = await loadTemplate(`${options.lang}/src/index.ts.ejs`, {
    name: options.projectName,
  });
  return { path: 'src/index.ts', content };
}

export async function generateTagprConfig(
  options: InitOptions,
): Promise<GeneratedFile> {
  const content = await loadTemplate(`${options.lang}/.tagpr.ejs`, {});
  return { path: '.tagpr', content };
}

export async function generateTagprWorkflow(
  options: InitOptions,
  actionVersions: Record<string, string>,
): Promise<GeneratedFile> {
  const content = await loadTemplate('common/workflows/tagpr.yml.ejs', {
    isDevcode: options.isDevcode,
    actionVersions,
  });
  return { path: '.github/workflows/tagpr.yml', content };
}

export async function generateCiWorkflow(
  options: InitOptions,
  actionVersions: Record<string, string>,
): Promise<GeneratedFile> {
  const content = await loadTemplate(`${options.lang}/workflows/ci.yml.ejs`, {
    actionVersions,
  });
  return { path: '.github/workflows/ci.yml', content };
}

export async function generateCodeqlWorkflow(
  options: InitOptions,
  actionVersions: Record<string, string>,
): Promise<GeneratedFile> {
  const content = await loadTemplate(
    `${options.lang}/workflows/codeql.yml.ejs`,
    { actionVersions },
  );
  return { path: '.github/workflows/codeql.yml', content };
}

export async function generateCodeqlConfig(
  options: InitOptions,
): Promise<GeneratedFile> {
  const content = await loadTemplate(
    `${options.lang}/codeql/codeql-config.yml.ejs`,
    { name: options.projectName },
  );
  return { path: '.github/codeql/codeql-config.yml', content };
}

export async function generateDependabot(
  options: InitOptions,
): Promise<GeneratedFile> {
  const content = await loadTemplate('common/dependabot.yml.ejs', {
    lang: options.lang,
  });
  return { path: '.github/dependabot.yml', content };
}

export async function generateReleaseConfig(): Promise<GeneratedFile> {
  const content = await loadTemplate('common/release.yml.ejs', {});
  return { path: '.github/release.yml', content };
}

export class FileWriteError extends Error {
  constructor(
    message: string,
    public readonly targetPath: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'FileWriteError';
  }
}

export async function writeGeneratedFiles(
  targetDir: string,
  files: GeneratedFile[],
): Promise<void> {
  try {
    await fs.mkdir(targetDir, { recursive: true });
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    throw new FileWriteError(
      `Failed to create target directory "${targetDir}": ${fsError.message}`,
      targetDir,
      fsError,
    );
  }

  for (const file of files) {
    const filePath = path.join(targetDir, file.path);
    const fileDir = path.dirname(filePath);

    try {
      if (fileDir !== targetDir) {
        await fs.mkdir(fileDir, { recursive: true });
      }
      await fs.writeFile(filePath, file.content, 'utf-8');
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      throw new FileWriteError(
        `Failed to write file "${file.path}" in "${targetDir}": ${fsError.message}`,
        filePath,
        fsError,
      );
    }
  }
}

export class ProjectNameError extends Error {
  constructor(
    message: string,
    public readonly projectName: string,
  ) {
    super(message);
    this.name = 'ProjectNameError';
  }
}

const VALID_PROJECT_NAME_REGEX = /^(@[\w-]+\/)?[\w][\w.-]*[\w]$|^[\w]$/;

export function validateProjectName(projectName: string): void {
  if (!projectName || projectName.trim() === '') {
    throw new ProjectNameError('Project name cannot be empty', projectName);
  }

  const nameWithoutScope = projectName.replace(/^@[\w-]+\//, '');
  if (nameWithoutScope.includes('/') || nameWithoutScope.includes('\\')) {
    throw new ProjectNameError(
      `Project name "${projectName}" contains invalid path separators`,
      projectName,
    );
  }

  if (nameWithoutScope.startsWith('.') || nameWithoutScope.endsWith('.')) {
    throw new ProjectNameError(
      `Project name "${projectName}" cannot start or end with a dot`,
      projectName,
    );
  }

  if (!VALID_PROJECT_NAME_REGEX.test(projectName)) {
    throw new ProjectNameError(
      `Project name "${projectName}" contains invalid characters. Use only letters, numbers, hyphens, underscores, and dots.`,
      projectName,
    );
  }
}

export async function generateProject(options: InitOptions): Promise<void> {
  validateProjectName(options.projectName);

  const outputDir = options.targetDir ?? options.projectName;
  const actionVersions = await getLatestActionVersions();

  const files: GeneratedFile[] = await Promise.all([
    generatePackageJson(options),
    generateTsconfig(options),
    generateEntryPoint(options),
    generateTagprConfig(options),
    generateTagprWorkflow(options, actionVersions),
    generateCiWorkflow(options, actionVersions),
    generateCodeqlWorkflow(options, actionVersions),
    generateCodeqlConfig(options),
    generateDependabot(options),
    generateReleaseConfig(),
  ]);

  try {
    await writeGeneratedFiles(outputDir, files);
  } catch (error) {
    if (error instanceof FileWriteError) {
      throw error;
    }
    throw new FileWriteError(
      `Failed to generate project "${options.projectName}": ${error instanceof Error ? error.message : String(error)}`,
      outputDir,
      error instanceof Error ? error : undefined,
    );
  }
}
