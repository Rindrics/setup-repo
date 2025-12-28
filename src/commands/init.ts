import * as readline from 'node:readline/promises';
import type { Command } from 'commander';
import { generateProject } from '../generators/project';
import type { InitOptions, Language } from '../types';

const SUPPORTED_LANGUAGES: Language[] = ['typescript'];

export function validateLanguage(lang: string): Language {
  if (!SUPPORTED_LANGUAGES.includes(lang as Language)) {
    throw new Error(
      `Unsupported language: ${lang}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
    );
  }
  return lang as Language;
}

export async function promptIsDevcode(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      'Is this a development code name? (y/N): ',
    );
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

export async function initProject(options: InitOptions): Promise<void> {
  const devcodeLabel = options.isDevcode ? ' [devcode]' : '';
  console.log(
    `Creating project: ${options.projectName} (${options.lang})${devcodeLabel}`,
  );

  await generateProject(options);

  console.log(`✅ Project created at ./${options.projectName}`);
}

interface InitCommandOptions {
  lang: string;
  devcode?: boolean;
  author?: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init <project-name>')
    .description(
      'Initialize a new project. <project-name> is the name used for npm publish.',
    )
    .option('-l, --lang <language>', 'Project language', 'typescript')
    .option(
      '-d, --devcode',
      'Mark project name as development code (will be replaced before release)',
    )
    .option(
      '-a, --author <name>',
      'Package author (defaults to npm whoami for TypeScript)',
    )
    .action(async (projectName: string, opts: InitCommandOptions) => {
      const lang = validateLanguage(opts.lang);

      // Use --devcode flag if provided, otherwise prompt
      const isDevcode =
        opts.devcode !== undefined ? opts.devcode : await promptIsDevcode();

      await initProject({ projectName, lang, isDevcode, author: opts.author });
    });
}
