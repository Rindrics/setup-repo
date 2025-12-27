import { describe, expect, test } from 'bun:test';
import packageJson from '../package.json';
import { createProgram } from './cli';

describe('CLI', () => {
  test('should have correct name from package.json', () => {
    const program = createProgram();
    expect(program.name()).toBe(packageJson.name);
  });

  test('should have correct version from package.json', () => {
    const program = createProgram();
    expect(program.version()).toBe(packageJson.version);
  });

  test('should have description', () => {
    const program = createProgram();
    expect(program.description()).toBe('Rapid repository setup CLI tool');
  });
});
