# Create OpenTUI App

A CLI tool for creating OpenTUI projects from templates. The CLI is developed with Vite+ and runs through npm, pnpm, Yarn, or Bun. Generated OpenTUI projects continue to use Bun as their runtime.

## Packages

- **[create-tui](./packages/cli/)** - The main CLI tool for creating projects (published to npm)
- **[templates](./packages/templates/)** - Project templates (not published, downloaded from GitHub)

## Quick Start

### Using the CLI (Recommended)

```bash
# npm
npm create tui@latest my-tui-project

# pnpm
pnpm create tui my-tui-project

# Yarn
yarn create tui my-tui-project

# Bun
bun create tui my-tui-project

# Initialize an empty current directory
bun create tui .
```

The CLI detects the package manager used to launch it and uses that same package manager to install the generated project's dependencies.

## Available Templates

### Built-in Templates (Aliases)

Simple names for the official templates:

| Alias   | Description                               |
| ------- | ----------------------------------------- |
| `core`  | Basic OpenTUI project                     |
| `react` | OpenTUI project with React integration    |
| `solid` | OpenTUI project with Solid.js integration |

### Custom GitHub Templates

The CLI supports three formats for specifying templates:

```bash
# 1. Aliases (built-in templates)
bun create tui -t react my-project

# 2. Shorthand (owner/repo or owner/repo/path)
bun create tui -t username/my-template my-project
bun create tui -t username/repo/path/to/template my-project

# 3. Full GitHub URL (with optional branch/path)
bun create tui -t https://github.com/user/repo my-project
bun create tui -t https://github.com/user/repo/tree/main/templates/starter my-project
```

Custom templates must have a `package.json` at the template root.

## Features

- **Flexible template input** - Use aliases, shorthand, or full GitHub URLs
- **Built-in templates** - Core, React, and Solid.js templates ready to use
- **Custom GitHub templates** - Use any GitHub repository or nested directory as a template
- **Update notifications** - Automatically checks for newer versions and notifies you
- **Git initialization** - Optionally initializes a git repository in new projects

## CLI Options

```
Options:
  -t, --template <template>  Template: alias (core, react, solid), shorthand (owner/repo), or GitHub URL
  --no-git                   Skip initializing a git repository
  --no-install               Skip installing dependencies
  -v, --verbose              Show detailed progress during template operations
  -h, --help                 Show help documentation
  --version                  Show the version of the application
```

### Examples

```bash
# Interactive mode (prompts for all options)
bun create tui my-project

# Initialize the current directory (it must be empty, except for .git)
bun create tui .

# Use an alias (built-in template)
bun create tui -t react my-project

# Use shorthand for a custom template
bun create tui -t username/my-template my-project

# Use a full GitHub URL with verbose output
bun create tui -t https://github.com/user/repo -v my-project
```

## Workspace Structure

```
packages/
├── cli/            # CLI tool package (published to npm)
│   ├── src/        # CLI source code
│   ├── dist/       # Built output
│   └── package.json
└── templates/      # Templates package (not published)
    ├── react/      # React template
    ├── core/       # Core template
    └── solid/      # Solid template
```

## Development

The repository uses [Vite+](https://viteplus.dev/) for package management, checks, tests, and packaging. Node.js `^22.18.0`, `^24.11.0`, or `>=26.0.0` is required for development.

```bash
npm install
npm run check
npm test
npm run build
```

Bun is only required for validating and updating the OpenTUI templates:

```bash
npm run check:templates
npm run update:opentui
```

## Publishing

The CLI package is published to npm as `create-tui`. Templates are downloaded directly from this GitHub repository.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Install dependencies with `npm install`
4. Make your changes
5. Run `npm run check`, `npm test`, and `npm run build`
6. Submit a pull request

## Attribution

This CLI tool is largely inspired by and derived from the [create-effect-app](https://github.com/effect-ts/examples/blob/main/packages/create-effect-app/). I extend my gratitude to the Effect-TS team for their excellent work.

## License

MIT
