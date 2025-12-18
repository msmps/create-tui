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

### Built-in Templates

- **core** - Basic OpenTUI project
- **react** - OpenTUI project with React integration
- **solid** - OpenTUI project with Solid.js integration

### Custom GitHub Templates

You can use any GitHub repository as a template by providing the full GitHub URL:

```bash
# Use a custom GitHub template
bun create tui --template https://github.com/user/repo my-project

# Use a nested directory within a repository (include tree/branch)
bun create tui --template https://github.com/user/repo/tree/main/templates/starter my-project
```

Custom templates must have a `package.json` at the template root.

## Features

- **Built-in templates** - Core, React, and Solid.js templates ready to use
- **Custom GitHub templates** - Use any GitHub repository or nested directory as a template
- **Update notifications** - Automatically checks for newer versions and notifies you
- **Git initialization** - Optionally initializes a git repository in new projects

## CLI Options

```
Options:
  -t, --template <template>  Template: built-in (core, react, solid) or GitHub URL
  --disable-git              Skip initializing a git repository
  -v, --verbose              Show detailed progress during template operations
  -h, --help                 Show help documentation
  --version                  Show the version of the application
```

### Examples

```bash
# Interactive mode (prompts for all options)
bun create tui my-project

# Use a built-in template
bun create tui --template react my-project

# Use a custom GitHub template with verbose output
bun create tui --template https://github.com/user/repo -v my-project

# Skip git initialization
bun create tui --template core --disable-git my-project
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
