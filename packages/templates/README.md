# templates

This package contains all the project templates used by the `create-tui` tool.

## Available Templates

### React

- **Path**: `react/`
- **Description**: OpenTUI project with React integration

### Core (Coming Soon)

- **Path**: `core/`
- **Description**: Basic OpenTUI project with core functionality

### Solid

- **Path**: `solid/`
- **Description**: OpenTUI project with Solid.js integration

## Template Structure

Each template should have:

- `package.json` - Package configuration
- `tsconfig.json` - TypeScript configuration
- `src/` - Source code directory
- `README.md` - Template-specific documentation
- `.gitignore` - Git ignore rules

## Adding New Templates

1. Create a new directory in this package
2. Add the required files mentioned above
3. Update the CLI's template list in `packages/cli/src/domain/template.ts`
4. Test the template with the CLI tool

## Notes

- Templates are not published to npm
- They are downloaded directly from the GitHub repository
- Keep templates minimal and focused on their specific use case
