import { afterEach, describe, expect, mock, test } from 'bun:test';
import { getLatestVersion, getLatestVersions, getNpmUsername } from './npm';

describe('npm utils', () => {
  describe('getLatestVersion', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test('should return version from npm registry', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '1.2.3' }),
        } as Response),
      ) as unknown as typeof fetch;

      const version = await getLatestVersion('some-package');
      expect(version).toBe('1.2.3');
    });

    test('should throw error when fetch fails', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
        } as Response),
      ) as unknown as typeof fetch;

      expect(getLatestVersion('some-package')).rejects.toThrow(
        'Failed to fetch version',
      );
    });
  });

  describe('getLatestVersions', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test('should return versions for multiple packages', async () => {
      globalThis.fetch = mock((url: string) => {
        const packageName = url.toString().split('/').slice(-2, -1)[0];
        const versions: Record<string, string> = {
          'package-a': '1.0.0',
          'package-b': '2.0.0',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: versions[packageName] }),
        } as Response);
      }) as unknown as typeof fetch;

      const versions = await getLatestVersions(['package-a', 'package-b']);
      expect(versions['package-a']).toBe('1.0.0');
      expect(versions['package-b']).toBe('2.0.0');
    });

    test('should fallback to "latest" when fetch fails', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
        } as Response),
      ) as unknown as typeof fetch;

      const versions = await getLatestVersions(['failing-package']);
      expect(versions['failing-package']).toBe('latest');
    });
  });

  describe('getNpmUsername', () => {
    test('should return username when logged in', async () => {
      const mockExec = mock(() =>
        Promise.resolve({ stdout: 'mocked-user\n', stderr: '' }),
      );

      const username = await getNpmUsername(mockExec);
      expect(username).toBe('mocked-user');
      expect(mockExec).toHaveBeenCalledWith('npm whoami');
    });

    test('should return null when stdout is empty', async () => {
      const mockExec = mock(() => Promise.resolve({ stdout: '', stderr: '' }));

      const username = await getNpmUsername(mockExec);
      expect(username).toBeNull();
    });

    test('should return null when npm whoami fails', async () => {
      const mockExec = mock(() => Promise.reject(new Error('Not logged in')));

      const username = await getNpmUsername(mockExec);
      expect(username).toBeNull();
    });
  });
});
