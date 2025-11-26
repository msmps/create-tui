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

- **core** - Basic OpenTUI project
- **react** - OpenTUI project with React integration
- **solid** - OpenTUI project with Solid.js integration

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
