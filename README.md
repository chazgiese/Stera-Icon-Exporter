# Stera Icon Exporter - Figma Plugin

A Figma plugin that exports icon components as a single JSON file with embedded SVG data, stable hashes, and comprehensive metadata for build stability and versioning.

## Features

- **Single JSON Export**: Exports all icons as one `icons-export.json` file
- **Stable Hashes**: Deterministic hashes for each variant enable diffing and incremental builds
- **Schema Versioning**: Built-in schema versioning for API compatibility
- **Normalized SVG**: Consistent, minified SVG output with deterministic hashing
- **Variant Validation**: Enforces tone opacity, viewBox requirements, and allowed variants
- **Sorted Output**: Predictable alphabetical ordering of icons and variants
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
  "schemaVersion": "1.0.0",
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "totalIcons": 2,
  "icons": [
    {
      "name": "arrow-right",
      "tags": ["arrow", "direction", "navigation", "right"],
      "variants": [
        {
          "variant": "Bold",
          "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M13 7l5 5-5 5M6 12h12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
          "hash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
        },
        {
          "variant": "Fill",
          "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M13 7l5 5-5 5M6 12h12\" fill=\"currentColor\"/></svg>",
          "hash": "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567"
        },
        {
          "variant": "Filltone",
          "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M13 7l5 5-5 5M6 12h12\" fill=\"currentColor\" opacity=\"0.32\"/></svg>",
          "hash": "c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678"
        }
      ]
    }
  ]
}
```

### Field Descriptions

- **`schemaVersion`**: Version of the JSON schema (manually bumped when structure changes)
- **`exportedAt`**: ISO timestamp of when the export was generated
- **`totalIcons`**: Total count of exported icons
- **`icons`**: Array of icon objects, sorted alphabetically by name
- **`name`**: Kebab-case icon name (e.g., "arrow-right", "heart-filled")
- **`tags`**: Array of lowercase, deduped, alphabetized tags
- **`variants`**: Array of variant objects, sorted alphabetically by variant name
- **`variant`**: One of `["Bold", "Fill", "Filltone", "Linetone", "Regular"]`
- **`svg`**: Normalized, minified SVG string with consistent formatting
- **`hash`**: Deterministic hash of the normalized SVG (stable across exports)

### Validation Rules

- **ViewBox**: All SVGs must have `viewBox="0 0 24 24"`
- **Tone Variants**: `Filltone` and `Linetone` variants must include `opacity="0.32"`
- **Non-tone Variants**: Must not contain fixed hex colors (`fill="#..."`)
- **Allowed Variants**: Only `["Bold", "Fill", "Filltone", "Linetone", "Regular"]` are supported

## Development

```bash
npm run dev  # Watch mode with auto-rebuild
```

## Requirements

- Node.js 16+
- Figma Desktop App

## License

MIT
