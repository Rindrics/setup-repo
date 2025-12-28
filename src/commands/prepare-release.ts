import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Command } from 'commander';

export interface PrepareReleaseOptions {
  /** New package name for release */
  publishName: string;
  /** Target directory (defaults to current directory) */
  targetDir?: string;
}

interface PackageJson {
  name: string;
  private?: boolean;
  [key: string]: unknown;
}

/**
 * Reads package.json and detects if this is a devcode project
 * Returns the devcode name if private: true, otherwise throws
 */
export async function detectDevcode(targetDir: string): Promise<string> {
  const packageJsonPath = path.join(targetDir, 'package.json');

  let content: string;
  try {
    content = await fs.readFile(packageJsonPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      throw new Error(
        'package.json not found. Are you in a project directory?',
      );
    }
    throw error;
  }

  const pkg = JSON.parse(content) as PackageJson;

  if (!pkg.private) {
    throw new Error(
      'This project is not a devcode project (missing "private": true in package.json)',
    );
  }

  return pkg.name;
}

/**
 * Updates package.json: replaces name and removes "private": true
 */
export async function updatePackageJson(
  targetDir: string,
  publishName: string,
): Promise<string> {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(content) as PackageJson;

  const devcode = pkg.name;

  // Update name
  pkg.name = publishName;

  // Remove private flag
  delete pkg.private;

  // Write back with consistent formatting
  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf-8',
  );

  return devcode;
}

/**
 * Updates tagpr.yml: switches from GITHUB_TOKEN to PAT_FOR_TAGPR
 */
export async function updateTagprWorkflow(targetDir: string): Promise<void> {
  const workflowPath = path.join(targetDir, '.github/workflows/tagpr.yml');

  let content: string;
  try {
    content = await fs.readFile(workflowPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      console.warn('Warning: tagpr.yml not found, skipping');
      return;
    }
    throw error;
  }

  // Replace GITHUB_TOKEN with PAT_FOR_TAGPR in env
  content = content.replace(
    /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/g,
    'GITHUB_TOKEN: ${{ secrets.PAT_FOR_TAGPR }}',
  );

  // Add token to checkout if not present
  content = content.replace(
    /(uses: actions\/checkout@v\d+)\n(\s*)# TODO: After replace-devcode, add token: \$\{\{ secrets\.PAT_FOR_TAGPR \}\}/g,
    '$1\n$2with:\n$2  token: ${{ secrets.PAT_FOR_TAGPR }}',
  );

  // Remove remaining TODO comments
  content = content.replace(/\s*# TODO: After replace-devcode.*\n/g, '\n');

  // Clean up extra blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  await fs.writeFile(workflowPath, content, 'utf-8');
}

/**
 * Updates codeql-config.yml: replaces devcode name
 */
export async function updateCodeqlConfig(
  targetDir: string,
  devcode: string,
  publishName: string,
): Promise<void> {
  const configPath = path.join(targetDir, '.github/codeql/codeql-config.yml');

  let content: string;
  try {
    content = await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      console.warn('Warning: codeql-config.yml not found, skipping');
      return;
    }
    throw error;
  }

  content = content.replace(devcode, publishName);
  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Main prepare-release logic
 */
export async function prepareRelease(
  options: PrepareReleaseOptions,
): Promise<void> {
  const targetDir = options.targetDir ?? process.cwd();

  // Detect devcode from package.json (private: true)
  const devcode = await detectDevcode(targetDir);

  console.log(`Detected devcode project: ${devcode}`);
  console.log(`Preparing release: ${devcode} → ${options.publishName}`);

  // Update package.json (returns devcode for other updates)
  await updatePackageJson(targetDir, options.publishName);
  console.log('✅ Updated package.json');

  // Update tagpr.yml
  await updateTagprWorkflow(targetDir);
  console.log('✅ Updated tagpr.yml');

  // Update codeql-config.yml
  await updateCodeqlConfig(targetDir, devcode, options.publishName);
  console.log('✅ Updated codeql-config.yml');

  console.log(`\n🎉 Release preparation complete!`);
  console.log(`   Package renamed: ${devcode} → ${options.publishName}`);
  console.log(`   Private flag removed`);
  console.log(`   Workflows updated to use PAT_FOR_TAGPR`);

  console.log(`\n⚠️  Action required: Set up PAT_FOR_TAGPR secret`);
  console.log(`   1. Create a Personal Access Token (classic) at:`);
  console.log(`      https://github.com/settings/tokens/new`);
  console.log(`   2. Required permissions:`);
  console.log(`      • repo (Full control of private repositories)`);
  console.log(`        - or for public repos: public_repo`);
  console.log(`      • workflow (Update GitHub Action workflows)`);
  console.log(
    `   3. Add the token as a repository secret named PAT_FOR_TAGPR:`,
  );
  console.log(
    `      Settings → Secrets and variables → Actions → New repository secret`,
  );
}

export function registerPrepareReleaseCommand(program: Command): void {
  program
    .command('prepare-release <publish-name>')
    .description(
      'Prepare for release by replacing devcode with <publish-name> (auto-detects devcode from package.json)',
    )
    .option(
      '-t, --target-dir <path>',
      'Target directory (defaults to current directory)',
    )
    .action(async (publishName: string, opts: { targetDir?: string }) => {
      try {
        await prepareRelease({
          publishName,
          targetDir: opts.targetDir,
        });
      } catch (error) {
        console.error(
          `❌ Failed to prepare release: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });
}
