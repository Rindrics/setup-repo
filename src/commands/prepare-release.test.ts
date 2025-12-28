import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import {
  detectDevcode,
  prepareRelease,
  registerPrepareReleaseCommand,
  updateCodeqlConfig,
  updatePackageJson,
  updateTagprWorkflow,
} from './prepare-release';

describe('prepare-release command', () => {
  const testDir = path.join(import.meta.dir, '../../.test-prepare-release');

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.github/workflows'), {
      recursive: true,
    });
    await fs.mkdir(path.join(testDir, '.github/codeql'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('detectDevcode', () => {
    test('should return devcode name when private: true', async () => {
      const packageJson = {
        name: 'my-devcode',
        version: '0.0.0',
        private: true,
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson),
      );

      const devcode = await detectDevcode(testDir);
      expect(devcode).toBe('my-devcode');
    });

    test('should throw when private flag is missing', async () => {
      const packageJson = { name: 'my-project', version: '0.0.0' };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson),
      );

      expect(detectDevcode(testDir)).rejects.toThrow('not a devcode project');
    });

    test('should throw when package.json not found', async () => {
      expect(detectDevcode(testDir)).rejects.toThrow('package.json not found');
    });
  });

  describe('updatePackageJson', () => {
    test('should update name and remove private flag', async () => {
      const packageJson = {
        name: 'my-devcode',
        version: '0.0.0',
        private: true,
        description: 'Test project',
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      );

      const devcode = await updatePackageJson(testDir, '@scope/my-package');

      expect(devcode).toBe('my-devcode');

      const content = await fs.readFile(
        path.join(testDir, 'package.json'),
        'utf-8',
      );
      const updated = JSON.parse(content);

      expect(updated.name).toBe('@scope/my-package');
      expect(updated.private).toBeUndefined();
      expect(updated.version).toBe('0.0.0');
    });
  });

  describe('updateTagprWorkflow', () => {
    test('should replace GITHUB_TOKEN with PAT_FOR_TAGPR', async () => {
      const workflow = `name: tagpr
on:
  push:
    branches: [main]

jobs:
  tagpr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        # TODO: After replace-devcode, add token: \${{ secrets.PAT_FOR_TAGPR }}

      - uses: Songmu/tagpr@v1
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          # TODO: After replace-devcode, use PAT_FOR_TAGPR instead
`;
      await fs.writeFile(
        path.join(testDir, '.github/workflows/tagpr.yml'),
        workflow,
      );

      await updateTagprWorkflow(testDir);

      const content = await fs.readFile(
        path.join(testDir, '.github/workflows/tagpr.yml'),
        'utf-8',
      );

      expect(content).toContain('GITHUB_TOKEN: ${{ secrets.PAT_FOR_TAGPR }}');
      expect(content).toContain('token: ${{ secrets.PAT_FOR_TAGPR }}');
      expect(content).not.toContain('secrets.GITHUB_TOKEN');
      expect(content).not.toContain('TODO: After replace-devcode');
    });
  });

  describe('updateCodeqlConfig', () => {
    test('should replace devcode name', async () => {
      const config = `name: "CodeQL config for my-devcode"

paths:
  - src
`;
      await fs.writeFile(
        path.join(testDir, '.github/codeql/codeql-config.yml'),
        config,
      );

      await updateCodeqlConfig(testDir, 'my-devcode', '@scope/my-package');

      const content = await fs.readFile(
        path.join(testDir, '.github/codeql/codeql-config.yml'),
        'utf-8',
      );

      expect(content).toContain('@scope/my-package');
      expect(content).not.toContain('my-devcode');
    });
  });

  describe('prepareRelease', () => {
    test('should auto-detect devcode and update all files', async () => {
      // Setup test files with private: true
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'devcode', version: '0.0.0', private: true }),
      );
      await fs.writeFile(
        path.join(testDir, '.github/workflows/tagpr.yml'),
        `name: tagpr
jobs:
  tagpr:
    steps:
      - uses: actions/checkout@v6
        # TODO: After replace-devcode, add token: \${{ secrets.PAT_FOR_TAGPR }}
      - uses: Songmu/tagpr@v1
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,
      );
      await fs.writeFile(
        path.join(testDir, '.github/codeql/codeql-config.yml'),
        'name: "CodeQL config for devcode"',
      );

      await prepareRelease({
        publishName: '@scope/package',
        targetDir: testDir,
      });

      // Verify package.json
      const pkg = JSON.parse(
        await fs.readFile(path.join(testDir, 'package.json'), 'utf-8'),
      );
      expect(pkg.name).toBe('@scope/package');
      expect(pkg.private).toBeUndefined();

      // Verify tagpr.yml
      const tagpr = await fs.readFile(
        path.join(testDir, '.github/workflows/tagpr.yml'),
        'utf-8',
      );
      expect(tagpr).toContain('secrets.PAT_FOR_TAGPR');

      // Verify codeql-config.yml
      const codeql = await fs.readFile(
        path.join(testDir, '.github/codeql/codeql-config.yml'),
        'utf-8',
      );
      expect(codeql).toContain('@scope/package');
    });

    test('should fail if not a devcode project', async () => {
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'not-devcode', version: '1.0.0' }),
      );

      expect(
        prepareRelease({ publishName: '@scope/package', targetDir: testDir }),
      ).rejects.toThrow('not a devcode project');
    });
  });

  describe('registerPrepareReleaseCommand', () => {
    test('should register prepare-release command with publish-name argument', () => {
      const program = new Command();
      registerPrepareReleaseCommand(program);

      const cmd = program.commands.find((c) => c.name() === 'prepare-release');
      expect(cmd).toBeDefined();
      expect(cmd?.description()).toContain('auto-detects');
    });

    test('should have target-dir option', () => {
      const program = new Command();
      registerPrepareReleaseCommand(program);

      const cmd = program.commands.find((c) => c.name() === 'prepare-release');
      const options = cmd?.options.map((o) => o.long);

      expect(options).toContain('--target-dir');
    });
  });
});
