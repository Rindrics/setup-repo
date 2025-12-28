# @rindrics/initrepo

CLI tool for rapid repository setup with CI/CD, code quality tools, and release automation via [tagpr](https://github.com/Songmu/tagpr).

## Usage

### Create a new project

```bash
# Using npx (recommended)
npx @rindrics/initrepo init my-super-project

# Using pnpm
pnpm dlx @rindrics/initrepo init my-super-project

# Non-interactive mode
npx @rindrics/initrepo init my-super-project --devcode --create-repo --private
```

Options:
- `-d, --devcode` - Use devcode mode (adds `private: true` to package.json)
- `--create-repo` - Create GitHub repository with tagpr labels
- `-p, --private` - Make GitHub repository private
- `-a, --author <name>` - Package author

To create a GitHub repository, set `GITHUB_TOKEN`:

```bash
# Using GitHub CLI
GITHUB_TOKEN=$(gh auth token) npx @rindrics/initrepo init my-project --create-repo
```

### Prepare for release

When ready to publish, convert your devcode project:

```bash
cd my-super-project
npx @rindrics/initrepo prepare-release @scope/my-package
```

This will:
- Update `package.json` name and remove `private: true`
- Configure workflows for `PAT_FOR_TAGPR`
- Report any unmanaged occurrences of the devcode name for manual review

### Setup for automated releases

1. **Create a PAT** at https://github.com/settings/tokens/new
   - Permissions: `repo` (or `public_repo`), `workflow`
   - Add as repository secret: `PAT_FOR_TAGPR`

2. **Configure npm for GitHub Actions publishing**
   - Go to npmjs.com → Package Settings → Publishing access
   - Add your repository to trusted publishers

## License

MIT
