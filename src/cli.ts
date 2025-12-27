#!/usr/bin/env node
import { Command } from 'commander';
import packageJson from '../package.json';

const { version: VERSION, name: NAME } = packageJson;

export function createProgram(): Command {
  const program = new Command();

  program
    .name(NAME)
    .description('Rapid repository setup CLI tool')
    .version(VERSION);

  return program;
}

// Run CLI when executed directly
if (import.meta.main) {
  const program = createProgram();
  program.parse();
}
