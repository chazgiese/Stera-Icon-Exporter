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
   - Navigate to the page with your icon components
   - Ensure components are in component sets with:
     - **Weight** property: `Regular`, `Bold`, or `Fill`
     - **Duotone** property: `True` or `False`
   - Name your component sets (e.g., `arrow-left`, `heart`)
   - Add descriptions with comma-separated tags (optional)

2. **Run the Plugin**:
   - Run the plugin in Figma
   - Click "Export Icons"
   - Download the `icons-export.json` file

## Output

The plugin generates a single `icons-export.json` file containing all icons with their variants, SVG data, and metadata.

## Troubleshooting

- **"No components found"**: Ensure your icon components are on the current page
- **Component set structure**: Each component set should have Weight and Duotone variant properties
- **Build errors**: Run `npm install` to ensure all dependencies are installed
- **"Unable to load code" error**: Make sure to run `npm run build` after making changes to copy the UI file to the root directory

## Development

For development with auto-rebuild:
```bash
npm run dev
```

This will watch for changes and automatically rebuild the plugin.
