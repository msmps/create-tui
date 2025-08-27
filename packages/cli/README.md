# create-tui

A CLI tool for creating OpenTUI projects from templates.

## Installation

```bash
# Use with bun (no installation required)
bun create tui my-tui-project
```

## Usage

### Interactive Mode

```bash
bun create tui
```

This will prompt you for:

- Project name
- Template choice (Core, React, Solid)

### With Arguments

```bash
# Create a React project
bun create tui my-react-app --template react

# Create a Core project
bun create tui my-core-app --template core

# Create a Solid project
bun create tui my-solid-app --template solid
```

## Available Templates

- **core**: OpenTUI project with core functionality
- **react**: OpenTUI project with React integration
- **solid**: OpenTUI project with Solid.js integration

## Options

- `--template, -t`: Specify the template to use (core, react, solid)
- `--help`: Show help information
- `--version`: Show version number

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
