# create-tui

A CLI tool for creating OpenTUI projects from templates.

## Installation

```bash
# Use with bun (no installation required)
bun create tui my-tui-project
```

## What It Does

When you run `create-tui`, the CLI performs the following steps:

1. **Template Validation** — Validates the template exists on GitHub
2. **Project Directory Setup** — Creates the project directory (or prompts to delete if it already exists)
3. **Template Download** — Downloads the selected template from GitHub
4. **Package Configuration** — Updates `package.json` with your project name
5. **Dependency Installation** — Installs all dependencies using your package manager
6. **Git Initialization** — Optionally initializes a git repository
7. **Update Check** — Checks for newer versions and notifies you if an update is available

## Usage

### Interactive Mode

```bash
bun create tui
```

This will prompt you for:

- Project name
- Template choice (Core, React, Solid, or Custom)
### With Arguments

```bash
# Create a React project
bun create tui -t react my-react-app

# Create a Core project
bun create tui -t core my-core-app

# Create a Solid project
bun create tui -t solid my-solid-app

# Create a project without git initialization
bun create tui -t core --no-git my-app
```

## Template Formats

The CLI supports three formats for specifying templates:

### 1. Aliases (Built-in Templates)

Simple names for the official templates:

```bash
bun create tui -t core my-project
bun create tui -t react my-project
bun create tui -t solid my-project
```

### 2. Shorthand (owner/repo)

Use any GitHub repository with a shorthand syntax:

```bash
# Use a repository root as template
bun create tui -t username/my-template my-project

# Use a nested directory within a repository
bun create tui -t username/repo/path/to/template my-project
```

### 3. Full GitHub URL

For maximum clarity or when you need to specify a branch:

```bash
# Repository root
bun create tui -t https://github.com/username/repo my-project

# Specific branch and path
bun create tui -t https://github.com/username/repo/tree/main/templates/starter my-project

# With verbose output to see detailed progress
bun create tui -t https://github.com/username/repo -v my-project
```

All templates must have a `package.json` file at the template root.

## Available Templates

### Built-in Templates (Aliases)

| Alias   | Description                               |
| ------- | ----------------------------------------- |
| `core`  | OpenTUI project with core functionality   |
| `react` | OpenTUI project with React integration    |
| `solid` | OpenTUI project with Solid.js integration |

### Custom Templates

Any public GitHub repository can be used as a template. Use either shorthand (`owner/repo/path`) or full GitHub URLs.

## Arguments

| Argument       | Description                            | Required |
| -------------- | -------------------------------------- | -------- |
| `project-name` | The folder to bootstrap the project in | No       |

## Options

| Option       | Alias | Description                                                                 |
| ------------ | ----- | --------------------------------------------------------------------------- |
| `--template` | `-t`  | Template: alias (core, react, solid), shorthand (owner/repo), or GitHub URL |
| `--no-git`   |       | Skip initializing a git repository                                          |
| `--verbose`  | `-v`  | Show detailed progress during template validation and download              |
| `--help`     | `-h`  | Show help information                                                       |
| `--version`  |       | Show version number                                                         |

## Update Notifications

The CLI automatically checks for newer versions after each run. If an update is available, you'll see a notification with the command to update:

```
Update available! 1.0.0 -> 1.1.0
Run bun add -g create-tui@latest to update
```

This check is non-blocking and times out after 3 seconds to avoid slowing down the CLI.

## Error Handling

The CLI provides helpful error messages for common issues:

| Scenario                | Error Message                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Invalid template format | `Invalid template: "xyz". Use an alias (core, react, solid), shorthand (owner/repo), or GitHub URL` |
| Repository not found    | `Repository not found: owner/repo`                                                                  |
| Missing package.json    | `Invalid template: missing package.json`                                                            |

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
