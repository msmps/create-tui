# create-tui

A CLI tool for creating OpenTUI projects from templates.

## Installation

```bash
# Use with bun (no installation required)
bun create tui my-tui-project
```

## What It Does

When you run `create-tui`, the CLI performs the following steps:

1. **Project Directory Setup** — Creates the project directory (or prompts to delete if it already exists)
2. **Template Download** — Downloads the selected template from GitHub
3. **Package Configuration** — Updates `package.json` with your project name
4. **Dependency Installation** — Installs all dependencies using your package manager
5. **Git Initialization** — Optionally initializes a git repository

## Usage

### Interactive Mode

```bash
bun create tui
```

This will prompt you for:

- Project name
- Template choice (Core, React, Solid)
- Whether to initialize a git repository

### With Arguments

```bash
# Create a React project
bun create tui my-react-app --template react

# Create a Core project
bun create tui my-core-app --template core

# Create a Solid project
bun create tui my-solid-app --template solid

# Create a project without git initialization
bun create tui my-app --disable-git
```

## Available Templates

- **core**: OpenTUI project with core functionality
- **react**: OpenTUI project with React integration
- **solid**: OpenTUI project with Solid.js integration

## Arguments

| Argument       | Description                            | Required |
| -------------- | -------------------------------------- | -------- |
| `project-name` | The folder to bootstrap the project in | No       |

## Options

| Option          | Alias | Description                               |
| --------------- | ----- | ----------------------------------------- |
| `--template`    | `-t`  | Specify the template (core, react, solid) |
| `--disable-git` |       | Skip initializing a git repository        |
| `--help`        |       | Show help information                     |
| `--version`     |       | Show version number                       |

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build for production
bun run build
```

## License

MIT
