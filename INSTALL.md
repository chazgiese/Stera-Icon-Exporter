# Installation Guide

## Prerequisites

- Node.js 16+ installed
- Figma Desktop App
- A Figma file with icon components

## Setup Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Plugin**:
   ```bash
   npm run build
   ```

3. **Install in Figma**:
   - Open Figma Desktop App
   - Go to `Plugins` → `Development` → `Import plugin from manifest...`
   - Select the `manifest.json` file from this project
   - The plugin will appear in your plugins list

## Usage

1. **Prepare Your Figma File**:
   - Create a page named exactly `/icons` (with the forward slash)
   - Add your icon components to this page
   - Name your components directly:
     - Examples: `arrow-left`, `facebook`, `menu`
   - Add descriptions with comma-separated tags:
     - Example: "navigation, directional, left" for an arrow-left icon

2. **Run the Plugin**:
   - Open your Figma file with the `/icons` page
   - Go to `Plugins` → `Icon Pipeline`
   - Click "Export Icons"
   - The plugin will download SVG files and a metadata JSON file

## Output

The plugin will download:
- Individual SVG files for each icon component (in flat structure)
- A `icons.meta.json` file containing all metadata

## Troubleshooting

- **"No /icons page found"**: Make sure you have a page named exactly `/icons` (case-sensitive)
- **"No components found"**: Ensure your icon components are on the `/icons` page
- **Build errors**: Run `npm install` to ensure all dependencies are installed
- **"Unable to load code" error**: Make sure to run `npm run build` after making changes to copy the UI file to the root directory

## Development

For development with auto-rebuild:
```bash
npm run dev
```

This will watch for changes and automatically rebuild the plugin.
