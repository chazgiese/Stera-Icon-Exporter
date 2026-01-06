# Stera Icon Exporter - Figma Plugin

A Figma plugin that exports icon components as a single JSON file with embedded SVG data, stable hashes, and comprehensive metadata for build stability and versioning.

## Features

- **Single JSON Export**: Exports all icons as one `icons-export.json` file
- **Stable Hashes**: Deterministic hashes for each variant enable diffing and incremental builds
- **Schema Versioning**: Built-in schema versioning for API compatibility
- **Normalized SVG**: Consistent, minified SVG output with deterministic hashing
- **Variant Validation**: Enforces viewBox requirements and validates weight/duotone properties
- **Sorted Output**: Predictable ordering of icons (alphabetical) and variants (by weight, then duotone)
- **Kebab-case Names**: Consistent naming convention for all icon names
- **Processed Tags**: Lowercase, deduped, and alphabetized tag arrays
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
  "schemaVersion": "2.0.0",
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "totalIcons": 2,
  "icons": [
    {
      "name": "arrow-right",
      "tags": ["arrow", "direction", "navigation", "right"],
      "variants": [
        {
          "variant": {
            "weight": "Regular",
            "duotone": false
          },
          "svg": "<svg viewBox=\"0 0 24 24\"...",
          "hash": "a1b2c3d4"
        },
        {
          "variant": {
            "weight": "Bold",
            "duotone": false
          },
          "svg": "<svg viewBox=\"0 0 24 24\"...",
          "hash": "b2c3d4e5"
        },
        {
          "variant": {
            "weight": "Fill",
            "duotone": true
          },
          "svg": "<svg viewBox=\"0 0 24 24\"...",
          "hash": "c3d4e5f6"
        }
      ]
    }
  ]
}
```

### Field Descriptions

- **`schemaVersion`**: Schema version (currently `2.0.0`)
- **`exportedAt`**: ISO timestamp of when the export was generated
- **`totalIcons`**: Total count of exported icons
- **`icons`**: Array of icon objects, sorted alphabetically by name
- **`name`**: Kebab-case icon name (e.g., "arrow-right")
- **`tags`**: Array of lowercase, deduped, alphabetized tags
- **`variants`**: Array of variant objects, sorted by weight then duotone
- **`variant.weight`**: One of `"Regular"`, `"Bold"`, or `"Fill"`
- **`variant.duotone`**: Boolean (`true` or `false`)
- **`svg`**: Normalized, minified SVG string
- **`hash`**: Deterministic hash of the normalized SVG

### Component Set Structure

Icons are exported from Figma component sets with:
- **Weight** property: `Regular`, `Bold`, or `Fill`
- **Duotone** property: `True` or `False`

This yields 6 variants per icon: Regular (×2 duotone states), Bold (×2), Fill (×2).

### Validation Rules

- **ViewBox**: All SVGs must have `viewBox="0 0 24 24"`
- **Non-duotone variants**: Must not contain fixed hex colors (`fill="#..."`)

## Development

```bash
npm run dev  # Watch mode with auto-rebuild
```

## Requirements

- Node.js 16+
- Figma Desktop App

## License

MIT
