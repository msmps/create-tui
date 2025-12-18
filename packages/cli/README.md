# create-tui

A CLI tool for creating OpenTUI projects from templates.

## Installation

```bash
# Use with bun (no installation required)
bun create tui my-tui-project
```

## What It Does

When you run `create-tui`, the CLI performs the following steps:

1. **Template Validation** — For custom GitHub templates, validates the repository exists
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
- Template choice (Core, React, Solid)
- Whether to initialize a git repository

### With Arguments

```bash
# Create a React project
bun create tui --template react my-react-app

# Create a Core project
bun create tui --template core my-core-app

# Create a Solid project
bun create tui --template solid my-solid-app

# Create a project without git initialization
bun create tui --template core --disable-git my-app
```

### Custom GitHub Templates

You can use any GitHub repository as a template by providing the full GitHub URL:

```bash
# Use a custom GitHub template
bun create tui --template https://github.com/user/repo my-project

# Use a nested directory within a repository (include tree/branch)
bun create tui --template https://github.com/user/repo/tree/main/templates/starter my-project

# With verbose output to see detailed progress
bun create tui --template https://github.com/user/repo -v my-project
```

Custom templates must have a `package.json` file at the template root.

## Available Templates

### Built-in Templates

- **core**: OpenTUI project with core functionality
- **react**: OpenTUI project with React integration
- **solid**: OpenTUI project with Solid.js integration

### Custom Templates

Any public GitHub repository can be used as a template by providing the full GitHub URL. You can also use nested directories by including `tree/branch` in the URL. The template location must contain a valid `package.json`.

## Arguments

| Argument       | Description                            | Required |
| -------------- | -------------------------------------- | -------- |
| `project-name` | The folder to bootstrap the project in | No       |

## Options

| Option          | Alias | Description                                                    |
| --------------- | ----- | -------------------------------------------------------------- |
| `--template`    | `-t`  | Template: built-in (core, react, solid) or GitHub URL          |
| `--disable-git` |       | Skip initializing a git repository                             |
| `--verbose`     | `-v`  | Show detailed progress during template validation and download |
| `--help`        | `-h`  | Show help information                                          |
| `--version`     |       | Show version number                                            |

## Update Notifications

The CLI automatically checks for newer versions after each run. If an update is available, you'll see a notification with the command to update:

```
⚠ Update available! 1.0.0 -> 1.1.0
⚠ Run bun add -g create-tui@latest to update
```

This check is non-blocking and times out after 3 seconds to avoid slowing down the CLI.

## Error Handling

The CLI provides helpful error messages for common issues:

| Scenario                | Error Message                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Invalid template format | `Invalid template: "xyz". Use a built-in template (core, react, solid) or a GitHub URL`                     |
| Repository not found    | `Template repository not found: https://github.com/user/repo`                                               |
| Missing package.json    | `Invalid template: missing package.json at template root.`                                                  |

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
