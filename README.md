# Stera Icon Exporter - Figma Plugin

A Figma plugin that exports icon components as a single JSON file with embedded SVG data and metadata.

## Features

- **Single JSON Export**: Exports all icons as one `icons-export.json` file
- **Variant Support**: Handles component sets and individual variants
- **Embedded SVG**: SVG data is embedded directly in the JSON
- **Metadata**: Includes tags, names, and export information
- **Current Page**: Works with components on the currently viewed page

## Setup

```bash
npm install
npm run build
```

## Usage

1. **Prepare Your Figma File**:
   - Navigate to the page with your icon components
   - Name your components (e.g., `arrow-left`, `bubble`)
   - Add descriptions with comma-separated tags (optional)

2. **Export**:
   - Run the plugin in Figma
   - Click "Export Icons"
   - Download the `icons-export.json` file

## Output Format

The plugin generates a single JSON file with this structure:

```json
{
  "icons": [
    {
      "name": "alert-circle",
      "tags": "warning, caution, attention",
      "variants": [
        {
          "variant": "Regular",
          "svg": "<svg>...</svg>"
        },
        {
          "variant": "fill", 
          "svg": "<svg>...</svg>"
        }
      ]
    }
  ],
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "totalIcons": 1
}
```

## Development

```bash
npm run dev  # Watch mode with auto-rebuild
```

## Requirements

- Node.js 16+
- Figma Desktop App

## License

MIT
