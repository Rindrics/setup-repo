export type Language = 'typescript';

export interface InitOptions {
  /** The name used for npm publish (e.g., @scope/package-name) */
  projectName: string;
  lang: Language;
  /** If true, projectName is a development code that will be replaced later */
  isDevcode: boolean;
  /** Optional output directory path. Defaults to projectName if not specified. */
  targetDir?: string;
  /** Package author. If not specified, detected from language-specific tools (e.g., npm whoami for TypeScript). */
  author?: string;
}
