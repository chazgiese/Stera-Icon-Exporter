# Stera Icon Exporter - Figma Plugin

A scalable Figma plugin that exports icon components as SVG files with metadata.

## Features

- **Current Page Detection**: Works with the currently viewed page in your Figma file
- **Component Export**: Exports each component as SVG to organized folder structure
- **Metadata Generation**: Creates `icons.meta.json` with component information
- **Tag Support**: Extracts tags from component descriptions
- **Flat Organization**: Simple flat file structure for easy access

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Plugin**:
   ```bash
   npm run build
   ```

3. **Development Mode** (with auto-rebuild):
   ```bash
   npm run dev
   ```

## Usage

1. **Prepare Your Figma File**:
   - Navigate to the page containing your icon components
   - Add your icon components to this page
   - Name your components (e.g., `arrow-left`, `facebook`, `menu`)
   - Add descriptions with comma-separated tags (e.g., "navigation, directional, left")

2. **Run the Plugin**:
   - Install the plugin in Figma
   - Navigate to the page with your icon components
   - Run the plugin and click "Export Icons"

3. **Output Structure**:
   ```
   icons/
   ├── svg/
   │   ├── arrow-left.svg
   │   ├── arrow-right.svg
   │   └── facebook.svg
   └── icons.meta.json
   ```

## Metadata Format

The generated `icons.meta.json` contains:

```json
{
  "icons": [
    {
      "name": "arrow-left",
      "variant": "arrow-left",
      "tags": ["navigation", "directional", "left"],
      "figmaId": "component-id"
    }
  ],
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "totalIcons": 1
}
```

## Development

- **Source Code**: Located in `src/` directory
- **TypeScript**: Full TypeScript support with Figma plugin types
- **Build Output**: Compiled files in root directory for Figma plugin system

## File Structure

```
├── manifest.json          # Figma plugin manifest
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── code.js               # Compiled plugin code (generated)
├── ui.html               # Plugin UI (generated)
├── src/
│   ├── code.ts           # Main plugin logic
│   └── ui.html           # Plugin UI template
└── README.md             # This file
```

## Requirements

- Node.js 16+
- TypeScript 5+
- Figma Desktop App

## License

MIT
