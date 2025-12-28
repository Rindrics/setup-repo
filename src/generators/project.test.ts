import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as npmUtils from '../utils/npm';
import { getLatestActionVersions } from '../utils/github';
import {
  generateEntryPoint,
  generatePackageJson,
  generateProject,
  generateTagprConfig,
  generateTagprWorkflow,
  generateTsconfig,
  loadTemplate,
  ProjectNameError,
  TemplateError,
  validateProjectName,
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
        isDevcode: false,
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
    let getNpmUsernameSpy: ReturnType<typeof spyOn>;
    let getLatestVersionsSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      getNpmUsernameSpy = spyOn(npmUtils, 'getNpmUsername').mockResolvedValue(
        'mocked-user',
      );
      getLatestVersionsSpy = spyOn(
        npmUtils,
        'getLatestVersions',
      ).mockResolvedValue({
        '@biomejs/biome': '1.0.0',
        '@commitlint/cli': '1.0.0',
        '@commitlint/config-conventional': '1.0.0',
        'bun-types': '1.0.0',
        husky: '1.0.0',
        typescript: '1.0.0',
      });
    });

    afterEach(() => {
      getNpmUsernameSpy.mockRestore();
      getLatestVersionsSpy.mockRestore();
    });

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

    test('should include mocked author', async () => {
      const result = await generatePackageJson({
        projectName: 'test-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(result.content).toContain('"author": "mocked-user"');
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

  describe('validateProjectName', () => {
    test('should accept valid project names', () => {
      expect(() => validateProjectName('my-project')).not.toThrow();
      expect(() => validateProjectName('my_project')).not.toThrow();
      expect(() => validateProjectName('my-project-123')).not.toThrow();
      expect(() => validateProjectName('@scope/my-project')).not.toThrow();
      expect(() => validateProjectName('a')).not.toThrow();
    });

    test('should throw for empty project name', () => {
      expect(() => validateProjectName('')).toThrow(ProjectNameError);
      expect(() => validateProjectName('   ')).toThrow('cannot be empty');
    });

    test('should throw for path separators', () => {
      expect(() => validateProjectName('my/project')).toThrow(ProjectNameError);
      expect(() => validateProjectName('my\\project')).toThrow(
        'invalid path separators',
      );
    });

    test('should throw for leading/trailing dots', () => {
      expect(() => validateProjectName('.my-project')).toThrow(
        ProjectNameError,
      );
      expect(() => validateProjectName('my-project.')).toThrow(
        'cannot start or end with a dot',
      );
    });

    test('should throw for invalid characters', () => {
      expect(() => validateProjectName('my project')).toThrow(ProjectNameError);
      expect(() => validateProjectName('my$project')).toThrow(
        'invalid characters',
      );
    });
  });

  describe('generateTsconfig', () => {
    test('should generate tsconfig.json', async () => {
      const result = await generateTsconfig({
        projectName: 'test-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(result.path).toBe('tsconfig.json');
      expect(result.content).toContain('"target": "ES2022"');
      expect(result.content).toContain('"moduleResolution": "bundler"');
      expect(result.content).toContain('"bun-types"');
    });
  });

  describe('generateEntryPoint', () => {
    test('should generate src/index.ts with project name', async () => {
      const result = await generateEntryPoint({
        projectName: 'my-cool-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(result.path).toBe('src/index.ts');
      expect(result.content).toContain('my-cool-project');
    });
  });

  describe('generateTagprConfig', () => {
    test('should generate .tagpr with versionFile for TypeScript', async () => {
      const result = await generateTagprConfig({
        projectName: 'test-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(result.path).toBe('.tagpr');
      expect(result.content).toContain('versionFile = "package.json"');
    });
  });

  describe('generateTagprWorkflow', () => {
    // Helper to extract major version number from "vN" format
    function extractMajorVersion(content: string, action: string): number {
      const regex = new RegExp(`${action.replace('/', '\\/')}@v(\\d+)`);
      const match = content.match(regex);
      return match ? Number.parseInt(match[1], 10) : 0;
    }

    test('should generate tagpr.yml for devcode project', async () => {
      const actionVersions = await getLatestActionVersions();
      const result = await generateTagprWorkflow(
        {
          projectName: 'test-devcode',
          lang: 'typescript',
          isDevcode: true,
        },
        actionVersions,
      );

      expect(result.path).toBe('.github/workflows/tagpr.yml');
      expect(result.content).toContain(
        'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
      );
      expect(result.content).toContain('# TODO: After replace-devcode');

      // Version should be at least the minimum expected
      expect(
        extractMajorVersion(result.content, 'actions/checkout'),
      ).toBeGreaterThanOrEqual(5);
      expect(
        extractMajorVersion(result.content, 'Songmu/tagpr'),
      ).toBeGreaterThanOrEqual(1);
    });

    test('should generate tagpr.yml for production project', async () => {
      const actionVersions = await getLatestActionVersions();
      const result = await generateTagprWorkflow(
        {
          projectName: 'test-prod',
          lang: 'typescript',
          isDevcode: false,
        },
        actionVersions,
      );

      expect(result.path).toBe('.github/workflows/tagpr.yml');
      expect(result.content).toContain(
        'GITHUB_TOKEN: ${{ secrets.PAT_FOR_TAGPR }}',
      );
      expect(result.content).not.toContain('# TODO: After replace-devcode');

      // Version should be at least the minimum expected
      expect(
        extractMajorVersion(result.content, 'actions/checkout'),
      ).toBeGreaterThanOrEqual(4);
      expect(
        extractMajorVersion(result.content, 'Songmu/tagpr'),
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateProject', () => {
    let getNpmUsernameSpy: ReturnType<typeof spyOn>;
    let getLatestVersionsSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      getNpmUsernameSpy = spyOn(npmUtils, 'getNpmUsername').mockResolvedValue(
        'mocked-user',
      );
      getLatestVersionsSpy = spyOn(
        npmUtils,
        'getLatestVersions',
      ).mockResolvedValue({
        '@biomejs/biome': '1.0.0',
        '@commitlint/cli': '1.0.0',
        '@commitlint/config-conventional': '1.0.0',
        'bun-types': '1.0.0',
        husky: '1.0.0',
        typescript: '1.0.0',
      });
    });

    afterEach(() => {
      getNpmUsernameSpy.mockRestore();
      getLatestVersionsSpy.mockRestore();
    });

    test('should throw for invalid project name', async () => {
      expect(
        generateProject({
          projectName: '../evil-path',
          lang: 'typescript',
          isDevcode: false,
        }),
      ).rejects.toThrow(ProjectNameError);
    });

    test('should use targetDir for output while keeping projectName for package.json', async () => {
      const projectDir = path.join(testDir, 'new-project');

      await generateProject({
        projectName: 'new-project',
        lang: 'typescript',
        isDevcode: false,
        targetDir: projectDir,
      });

      const packageJsonPath = path.join(projectDir, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      expect(pkg.name).toBe('new-project');
      expect(pkg.author).toBe('mocked-user');
    });

    test('should generate all expected files', async () => {
      const projectDir = path.join(testDir, 'full-project');

      await generateProject({
        projectName: 'full-project',
        lang: 'typescript',
        isDevcode: true,
        targetDir: projectDir,
      });

      // Check all files exist
      const files = await fs.readdir(projectDir, { recursive: true });
      expect(files).toContain('package.json');
      expect(files).toContain('tsconfig.json');
      expect(files).toContain('.tagpr');
      expect(files).toContain(path.join('src', 'index.ts'));
      expect(files).toContain(path.join('.github', 'workflows', 'tagpr.yml'));
    });
  });
});
