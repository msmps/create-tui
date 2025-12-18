# Create OpenTUI App

A CLI tool for creating OpenTUI projects from templates, organized as a Bun workspace monorepo.

## Packages

- **[create-tui](./packages/cli/)** - The main CLI tool for creating projects (published to npm)
- **[templates](./packages/templates/)** - Project templates (not published, downloaded from GitHub)

## Quick Start

### Using the CLI (Recommended)

```bash
# Use with bun (no installation required)
bun create tui my-tui-project
```

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
  --disable-git              Skip initializing a git repository
  -v, --verbose              Show detailed progress during template operations
  -h, --help                 Show help documentation
  --version                  Show the version of the application
```

### Examples

```bash
# Interactive mode (prompts for all options)
bun create tui my-project

# Use an alias (built-in template)
bun create tui -t react my-project

# Use shorthand for a custom template
bun create tui -t username/my-template my-project

# Use a full GitHub URL with verbose output
bun create tui -t https://github.com/user/repo -v my-project

# Skip git initialization
bun create tui -t core --disable-git my-project
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

## Publishing

The CLI package is published to npm as `create-tui`. Templates are downloaded directly from this GitHub repository.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Attribution

This CLI tool is largely inspired by and derived from the [create-effect-app](https://github.com/effect-ts/examples/blob/main/packages/create-effect-app/). I extend my gratitude to the Effect-TS team for their excellent work.

## License

MIT
