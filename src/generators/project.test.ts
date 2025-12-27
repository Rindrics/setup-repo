import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  generatePackageJson,
  generateProject,
  loadTemplate,
  TemplateError,
  writeGeneratedFiles,
} from './project';

describe('project generator', () => {
  const testDir = path.join(import.meta.dir, '../../.test-output');

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('loadTemplate', () => {
    test('should throw TemplateError for path traversal attempt', async () => {
      expect(loadTemplate('../../../etc/passwd', {})).rejects.toThrow(
        TemplateError,
      );
      expect(loadTemplate('../../../etc/passwd', {})).rejects.toThrow(
        'resolves outside templates directory',
      );
    });

    test('should throw TemplateError for non-existent template', async () => {
      expect(loadTemplate('non-existent.ejs', {})).rejects.toThrow(
        TemplateError,
      );
      expect(loadTemplate('non-existent.ejs', {})).rejects.toThrow(
        'Template not found',
      );
    });

    test('should load and render valid template', async () => {
      const result = await loadTemplate('typescript/package.json.ejs', {
        name: 'test',
        author: '',
        versions: {
          '@biomejs/biome': '1.0.0',
          '@commitlint/cli': '1.0.0',
          '@commitlint/config-conventional': '1.0.0',
          'bun-types': '1.0.0',
          husky: '1.0.0',
          typescript: '1.0.0',
        },
      });

      expect(result).toContain('"name": "test"');
    });
  });

  describe('generatePackageJson', () => {
    test('should generate package.json with project name', async () => {
      const result = await generatePackageJson({
        projectName: 'my-awesome-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(result.path).toBe('package.json');
      expect(result.content).toContain('"name": "my-awesome-project"');
    });

    test('should include standard scripts', async () => {
      const result = await generatePackageJson({
        projectName: 'test-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(result.content).toContain('"dev"');
      expect(result.content).toContain('"build"');
      expect(result.content).toContain('"test"');
      expect(result.content).toContain('"check"');
    });
  });

  describe('writeGeneratedFiles', () => {
    test('should create directory and write files', async () => {
      const files = [
        { path: 'test.txt', content: 'hello world' },
        { path: 'nested/file.txt', content: 'nested content' },
      ];

      await writeGeneratedFiles(testDir, files);

      const file1 = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8');
      const file2 = await fs.readFile(
        path.join(testDir, 'nested/file.txt'),
        'utf-8',
      );

      expect(file1).toBe('hello world');
      expect(file2).toBe('nested content');
    });
  });

  describe('generateProject', () => {
    test('should create project directory with package.json', async () => {
      const projectDir = path.join(testDir, 'new-project');

      await generateProject({
        projectName: projectDir,
        lang: 'typescript',
        isDevcode: false,
      });

      const packageJson = await fs.readFile(
        path.join(projectDir, 'package.json'),
        'utf-8',
      );

      expect(packageJson).toContain('"name"');
    });
  });
});
