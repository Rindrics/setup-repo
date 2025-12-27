# ADR 0001: Simple Module Structure Over DDD

## Status

Accepted

## Context

We are building `@rindrics/repo-setup`, a CLI tool that generates project scaffolding with:

- CI/CD workflows (test, lint, tagpr, release)
- husky configuration
- Language-specific setup (TypeScript initially)
- GitHub repository setup (repo creation, tags, branch protection)

The tool has two main commands:

1. `init` - Initialize a new project with all configurations
2. `replace-devcode` - Replace development placeholder with production name and enable release workflow

We needed to decide on an appropriate architecture for this tool.

## Decision

We chose a **simple module-based structure** instead of Domain-Driven Design (DDD).

### Chosen Structure

```text
src/
├── cli.ts                    # CLI entry point (Commander.js)
├── commands/
│   ├── init.ts               # init command implementation
│   └── replace-devcode.ts    # replace-devcode command implementation
├── generators/
│   ├── languages/            # Language-specific logic
│   │   ├── index.ts          # Common interface & factory
│   │   └── typescript.ts     # TypeScript generator
│   ├── project.ts            # package.json, etc.
│   ├── cicd.ts               # GitHub Actions workflows
│   └── husky.ts              # husky setup
├── github/
│   └── client.ts             # GitHub API operations (Octokit)
├── templates/
│   ├── common/               # Language-agnostic templates
│   └── typescript/           # TypeScript-specific templates
└── types.ts                  # Shared type definitions
```

### Why Not DDD?

DDD excels when:

- Complex business rules exist (aggregates, value objects, domain events)
- A ubiquitous language with domain experts is needed
- The domain model evolves over time

This tool is essentially a **file generation utility**:

- **Input**: Project name, language, options
- **Output**: Generated files, GitHub repository

There are no:

- Domain entities to model
- Complex business invariants to protect
- Data persistence requiring repository patterns
- Use cases complex enough to warrant a separate application layer

### Language Support Strategy

Languages are supported through two mechanisms:

1. **`generators/languages/*.ts`** - Logic for each language (what files to generate, what dependencies to include, CI configuration)
2. **`templates/{lang}/`** - Actual template files for each language

A common `LanguageGenerator` interface ensures consistent behavior:

```typescript
interface LanguageGenerator {
  name: string;
  getFiles(): GeneratedFile[];
  getDependencies(): Dependencies;
  getCiConfig(): CiConfig;
}
```

Adding a new language requires:

1. Implementing `LanguageGenerator` in `generators/languages/`
2. Adding templates in `templates/{lang}/`
3. Registering in the factory function

## Consequences

### Positive

- **Simplicity**: Code is easy to navigate and understand
- **Testability**: Each module can be tested in isolation
- **Extensibility**: New generators or languages can be added without touching existing code
- **Right-sized**: No unnecessary abstraction layers
- **Fast development**: Less boilerplate, quicker iterations

### Negative

- **Limited structure for growth**: If the tool grows significantly in complexity, we may need to introduce more structure
- **No enforced boundaries**: Developers must exercise discipline to maintain separation of concerns

### Neutral

- If complex domain logic emerges (e.g., conditional generation rules, plugin systems), we can introduce targeted patterns without full DDD adoption
