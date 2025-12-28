/**
 * GitHub Actions configuration for generated workflows
 * Key: action name, Value: fallback version when API fetch fails
 */
export const GITHUB_ACTIONS = {
  'actions/checkout': 'v6',
  'Songmu/tagpr': 'v1',
  'oven-sh/setup-bun': 'v2',
  'github/codeql-action': 'v3',
} as const;

/** Default fallback version for unknown actions */
export const DEFAULT_ACTION_VERSION = 'v1';
