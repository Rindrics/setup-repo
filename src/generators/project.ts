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
  // Resolve and validate the path to prevent path traversal attacks
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
    // Fetch latest versions and npm username in parallel
    const [versions, author] = await Promise.all([
      getLatestVersions(DEV_DEPENDENCIES),
      getNpmUsername(),
    ]);
    const templatePath = `${options.lang}/package.json.ejs`;
    const content = await loadTemplate(templatePath, {
      name: options.projectName,
      isDevcode: options.isDevcode,
      author: author ?? '',
      versions,
    });
    return {
      path: 'package.json',
      content,
    };
  } catch (error) {
    throw new Error(
      `Failed to generate package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function generateTsconfig(
  options: InitOptions,
): Promise<GeneratedFile> {
  const templatePath = `${options.lang}/tsconfig.json.ejs`;
  const content = await loadTemplate(templatePath, {});
  return {
    path: 'tsconfig.json',
    content,
  };
}

export async function generateEntryPoint(
  options: InitOptions,
): Promise<GeneratedFile> {
  const templatePath = `${options.lang}/src/index.ts.ejs`;
  const content = await loadTemplate(templatePath, {
    name: options.projectName,
  });
  return {
    path: 'src/index.ts',
    content,
  };
}

export async function generateTagprConfig(
  options: InitOptions,
): Promise<GeneratedFile> {
  const templatePath = `${options.lang}/.tagpr.ejs`;
  const content = await loadTemplate(templatePath, {});
  return {
    path: '.tagpr',
    content,
  };
}

export async function generateTagprWorkflow(
  options: InitOptions,
): Promise<GeneratedFile> {
  const templatePath = 'common/workflows/tagpr.yml.ejs';
  const content = await loadTemplate(templatePath, {
    isDevcode: options.isDevcode,
  });
  return {
    path: '.github/workflows/tagpr.yml',
    content,
  };
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

// Allow scoped packages (@scope/name), letters, numbers, hyphens, underscores, and dots (not leading/trailing)
const VALID_PROJECT_NAME_REGEX = /^(@[\w-]+\/)?[\w][\w.-]*[\w]$|^[\w]$/;

export function validateProjectName(projectName: string): void {
  if (!projectName || projectName.trim() === '') {
    throw new ProjectNameError('Project name cannot be empty', projectName);
  }

  // Check for path separators (except in scoped package prefix)
  const nameWithoutScope = projectName.replace(/^@[\w-]+\//, '');
  if (nameWithoutScope.includes('/') || nameWithoutScope.includes('\\')) {
    throw new ProjectNameError(
      `Project name "${projectName}" contains invalid path separators`,
      projectName,
    );
  }

  // Check for leading/trailing dots
  if (nameWithoutScope.startsWith('.') || nameWithoutScope.endsWith('.')) {
    throw new ProjectNameError(
      `Project name "${projectName}" cannot start or end with a dot`,
      projectName,
    );
  }

  // Check for valid characters
  if (!VALID_PROJECT_NAME_REGEX.test(projectName)) {
    throw new ProjectNameError(
      `Project name "${projectName}" contains invalid characters. Use only letters, numbers, hyphens, underscores, and dots.`,
      projectName,
    );
  }
}

export async function generateProject(options: InitOptions): Promise<void> {
  validateProjectName(options.projectName);

  // Use targetDir if specified, otherwise use projectName as directory name
  const outputDir = options.targetDir ?? options.projectName;

  // Generate all project files in parallel
  const files: GeneratedFile[] = await Promise.all([
    generatePackageJson(options),
    generateTsconfig(options),
    generateEntryPoint(options),
    generateTagprConfig(options),
    generateTagprWorkflow(options),
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
