// This file contains the main plugin code that runs in Figma
// It will be compiled to code.js

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface IconVariant {
  variant: string;
  svg: string;
  hash: string;
}

interface IconData {
  name: string;
  tags: string[];
  variants: IconVariant[];
}

interface IconsExport {
  schemaVersion: string;
  exportedAt: string;
  totalIcons: number;
  icons: IconData[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCHEMA_VERSION = "1.0.0";
const ALLOWED_VARIANTS = ["Bold", "Fill", "Filltone", "Linetone", "Regular"];
const TONE_VARIANTS = ["Filltone", "Linetone"];
const REQUIRED_VIEWBOX = "0 0 24 24";

// Shape tags that are considered for deduplication
const SHAPE_TAGS = new Set([
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'
]);

// Attributes that suggest styling, references, or hooks and should not be deduplicated
const RISKY_ATTRIBUTES = [
  'id', 'class', 'style', 'filter', 'mask', 'clip-path', 'clipPath', 'transform'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Add hyphen before capital letters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters except hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates a stable hash for SVG content using a simple but effective algorithm
 * This provides consistent hashing for diffing and incremental builds
 */
function generateHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString(16);
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string, padded to 8 characters
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Processes and normalizes tags array
 */
function processTags(tagsString: string): string[] {
  if (!tagsString) return [];
  
  return tagsString
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag.length > 0)
    .filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
    .sort(); // Sort alphabetically
}

/**
 * Allows the plugin to periodically yield so the Figma UI stays responsive
 * during long-running exports.
 */
function yieldToFigma(ms: number = 0): Promise<void> {
  return new Promise((resolve) => {
    // setTimeout is supported in the Figma plugin sandbox and lets us
    // cooperatively yield without changing export results.
    setTimeout(() => resolve(), ms);
  });
}

/**
 * Normalizes SVG string for consistent output and hashing
 */
function normalizeSVG(svgString: string): string {
  try {
    // Remove any existing whitespace and normalize
    let normalized = svgString
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .trim();
    
    // Ensure viewBox is present and correct
    if (!normalized.includes('viewBox=')) {
      normalized = normalized.replace(
        /<svg\b([^>]*)>/i,
        `<svg$1 viewBox="${REQUIRED_VIEWBOX}">`
      );
    } else {
      // Normalize existing viewBox
      normalized = normalized.replace(
        /viewBox\s*=\s*["']([^"']*)["']/i,
        `viewBox="${REQUIRED_VIEWBOX}"`
      );
    }
    
    // Remove unstable attributes that shouldn't affect the hash
    normalized = normalized
      .replace(/\s+id\s*=\s*["'][^"']*["']/gi, '') // Remove id attributes
      .replace(/\s+class\s*=\s*["'][^"']*["']/gi, '') // Remove class attributes
      .replace(/\s+data-[^=]*\s*=\s*["'][^"']*["']/gi, ''); // Remove data attributes
    
    // Normalize attribute spacing
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  } catch (error) {
    console.error('Error normalizing SVG:', error);
    return svgString;
  }
}

/**
 * Deduplicates *exact* duplicate leaf shapes in an SVG string.
 * Safe-by-default: only removes elements proven visually redundant.
 * Works in Figma plugin (no DOM).
 */
function deduplicateSVG(svgString: string): string {
  const DEBUG_DEDUP = false;
  try {
    const svgMatch = svgString.match(/^<svg\b[^>]*>/i);
    if (!svgMatch) return svgString;
    const svgOpen = svgMatch[0];
    const svgClose = '</svg>';

    const start = svgOpen.length;
    const end = svgString.lastIndexOf(svgClose);
    if (end < start) return svgString;

    const body = svgString.slice(start, end);

    // Match self-closing or paired elements: <tag .../> OR <tag ...>...</tag>
    // We will only dedupe *leaf* shapes; paired-with-children will be kept.
    const elementRe = /<([A-Za-z_][\w:.-]*)(\s+[^>]*?)?\s*(\/>|>([\s\S]*?)<\/\1>)/g;

    // Quick helpers
    const collapseWs = (s: string) => s.replace(/\s+/g, ' ').trim();
    const stripNs = (tag: string) => tag.replace(/^[A-Za-z_]\w*:/, ''); // strip "svg:" etc.

    // Parse attributes into a sorted, normalized record
    const parseAttrs = (attrSrc = ''): Record<string,string> => {
      const out: Record<string,string> = {};
      // attr="..." | '...' | bare
      const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(attrSrc))) {
        const name = m[1];
        const val = m[2] || m[3] || m[4] || '';
        out[name] = val;
      }
      return out;
    };

    // Normalize attrs for hashing (ignore order & minor formatting)
    const normalizeAttrs = (attrs: Record<string,string>): Record<string,string> => {
      const norm: Record<string,string> = {};
      for (const [k, v] of Object.entries(attrs)) {
        let vv = v;
        // normalize whitespace
        vv = vv.replace(/\s+/g, ' ').trim();
        // normalize path data spacing (do NOT alter numbers/content)
        if (k === 'd') vv = vv.replace(/\s+/g, ' ').trim();
        norm[k] = vv;
      }
      return norm;
    };

    // Remove only when provably safe not to change rendering
    const isSafeToRemove = (tag: string, attrs: Record<string,string>, hasChildren: boolean): boolean => {
      if (hasChildren) return false; // only leaf nodes
      const t = stripNs(tag).toLowerCase();
      if (!SHAPE_TAGS.has(t)) return false;

      const a = attrs;
      const val = (k: string, def = '') => (a[k] || def).trim();

      // Anything that suggests styling, references, or hooks → keep
      if (RISKY_ATTRIBUTES.some(k => a[k] != null)) return false;
      if (Object.values(a).some(v => /url\(#/.test(v))) return false;

      // Opacity guards
      const full = (k: string) => (a[k] == null) || /^[01](?:\.0+)?$/.test(a[k] as string);
      if (!full('opacity')) return false;
      if (!full('fill-opacity')) return false;
      if (!full('stroke-opacity')) return false;

      // Strokes can change visual weight when doubled; require absence
      if (a['stroke'] != null && a['stroke'] !== 'none') return false;

      // OK to remove duplicates of pure fills at full opacity
      return true;
    };

    // Canonical key = tag + sorted attrs (name=value)
    const keyOf = (tag: string, attrs: Record<string,string>): string => {
      const t = stripNs(tag).toLowerCase();
      const norm = normalizeAttrs(attrs);
      const keys = Object.keys(norm).sort();
      // You can choose to *exclude* benign attrs from the key if desired.
      const pairs = keys.map(k => `${k}=${norm[k]}`);
      return `${t}|${pairs.join(';')}`;
    };

    const seen = new Set<string>();
    const out: string[] = [];
    let removed = 0;

    elementRe.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = elementRe.exec(body))) {
      const [, rawTag, rawAttrs = '', selfOrClose, inner = ''] = m;
      const tag = rawTag;
      const hasChildren = selfOrClose.startsWith('>'); // paired form
      const attrs = parseAttrs(rawAttrs);

      // Only dedupe safe leaf shapes; otherwise keep as-is
      if (isSafeToRemove(tag, attrs, hasChildren)) {
        const k = keyOf(tag, attrs);
        if (seen.has(k)) {
          removed++;
          continue; // drop duplicate
        }
        seen.add(k);
      }

      // Keep original element exactly as authored
      out.push(m[0]);
    }

    if (DEBUG_DEDUP && removed > 0) {
      console.log(`[deduplicateSVG] removed ${removed} duplicate element(s)`);
    }

    return `${svgOpen}${out.join('')}${svgClose}`;
  } catch (err) {
    console.error('[deduplicateSVG] error', err);
    return svgString;
  }
}

/**
 * Validates SVG content for tone variants and other requirements
 */
function validateSVG(svgString: string, variant: string): ValidationResult {
  const errors: string[] = [];
  
  // Check basic SVG structure
  if (!svgString.trim().startsWith('<svg')) {
    errors.push('SVG does not start with <svg tag');
  }
  
  if (!svgString.trim().endsWith('</svg>')) {
    errors.push('SVG does not end with </svg> tag');
  }
  
  // Check for proper opening and closing tag balance
  const openTags = (svgString.match(/<svg[^>]*>/gi) || []).length;
  const closeTags = (svgString.match(/<\/svg>/gi) || []).length;
  if (openTags !== closeTags) {
    errors.push(`SVG tag mismatch: ${openTags} opening tags, ${closeTags} closing tags`);
  }
  
  // Check viewBox
  if (!svgString.includes(`viewBox="${REQUIRED_VIEWBOX}"`)) {
    errors.push(`Missing or incorrect viewBox. Expected: "${REQUIRED_VIEWBOX}"`);
  }
  
  // Non-tone variants should not have fixed hex colors
  if (!TONE_VARIANTS.includes(variant)) {
    const hexColorRegex = /fill\s*=\s*["']#[0-9a-fA-F]{3,6}["']/g;
    if (hexColorRegex.test(svgString)) {
      errors.push(`Non-tone variant "${variant}" should not contain fixed hex colors (fill="#...")`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// COMPONENT PROCESSING FUNCTIONS
// ============================================================================

/**
 * Gets all components and component sets from a page
 */
function getComponentsFromPage(page: PageNode): { components: ComponentNode[], componentSets: any[] } {
  const components: ComponentNode[] = [];
  const componentSets: any[] = [];
  
  function traverse(node: any) {
    if (node.type === 'COMPONENT') {
      components.push(node as ComponentNode);
    } else if (node.type === 'COMPONENT_SET') {
      // Handle component sets (variants)
      componentSets.push(node);
      if ('children' in node) {
        for (const child of node.children) {
          if (child.type === 'COMPONENT') {
            components.push(child as ComponentNode);
          }
        }
      }
    }
    
    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  traverse(page);
  return { components, componentSets };
}

/**
 * Groups components by their base name for processing individual components
 */
function groupComponentsByBaseName(components: ComponentNode[]): { [baseName: string]: ComponentNode[] } {
  const groups: { [baseName: string]: ComponentNode[] } = {};
  
  components.forEach(component => {
    const name = component.name;
    
    // Extract base name (everything before the last slash or variant indicator)
    let baseName = name;
    
    // Handle variant naming patterns like "icon-name/variant" or "icon-name=variant"
    if (name.includes('/')) {
      baseName = name.split('/')[0];
    } else if (name.includes('=')) {
      baseName = name.split('=')[0];
    } else if (name.includes(' - ')) {
      baseName = name.split(' - ')[0];
    }
    
    if (!groups[baseName]) {
      groups[baseName] = [];
    }
    groups[baseName].push(component);
  });
  
  return groups;
}

/**
 * Checks for duplicate icon names across component sets and individual components
 * Returns an array of duplicate names found
 */
function checkForDuplicateNames(componentSets: any[], components: ComponentNode[]): string[] {
  const nameCounts: { [key: string]: number } = {};
  const duplicateNames: string[] = [];
  
  // Count component set names
  componentSets.forEach(componentSet => {
    const setName = (componentSet as any).name;
    if (setName) {
      nameCounts[setName] = (nameCounts[setName] || 0) + 1;
    }
  });
  
  // Count individual component base names (grouped by base name like component sets)
  const individualComponents = components.filter(comp => {
    // Check if this component is already part of a component set
    let isPartOfComponentSet = false;
    for (const componentSet of componentSets) {
      if ('children' in componentSet) {
        for (const child of componentSet.children) {
          if (child.type === 'COMPONENT' && (child as any).id === (comp as any).id) {
            isPartOfComponentSet = true;
            break;
          }
        }
      }
      if (isPartOfComponentSet) break;
    }
    return !isPartOfComponentSet;
  });
  
  // Group individual components by base name (same logic as in groupComponentsByBaseName)
  const individualGroups: { [baseName: string]: ComponentNode[] } = {};
  individualComponents.forEach(component => {
    const name = component.name;
    
    // Extract base name (everything before the last slash or variant indicator)
    let baseName = name;
    
    // Handle variant naming patterns like "icon-name/variant" or "icon-name=variant"
    if (name.includes('/')) {
      baseName = name.split('/')[0];
    } else if (name.includes('=')) {
      baseName = name.split('=')[0];
    } else if (name.includes(' - ')) {
      baseName = name.split(' - ')[0];
    }
    
    if (!individualGroups[baseName]) {
      individualGroups[baseName] = [];
    }
    individualGroups[baseName].push(component);
  });
  
  // Count individual component group names
  Object.keys(individualGroups).forEach(baseName => {
    nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
  });
  
  // Find duplicates
  Object.entries(nameCounts).forEach(([name, count]) => {
    if (count > 1) {
      duplicateNames.push(name);
    }
  });
  
  return duplicateNames;
}

/**
 * Processes a group of components into icon data
 */
async function processIconGroup(baseName: string, components: ComponentNode[]): Promise<IconData> {
  // Get tags from the first component (they should be the same for all variants)
  const firstComponent = components[0];
  
  // Get description using official Figma Plugin API
  // Note: There's a known bug in Figma where description field may appear missing
  // until nodes are re-published. We'll try both plain text and markdown versions.
  let description = '';
  
  // Primary method: Use official description property (plain text)
  if ((firstComponent as any).description) {
    description = (firstComponent as any).description;
  }
  // Fallback: Try descriptionMarkdown (rich text with markdown)
  else if ((firstComponent as any).descriptionMarkdown) {
    // Convert markdown to plain text for tags (remove markdown syntax)
    const markdownDesc = (firstComponent as any).descriptionMarkdown;
    description = markdownDesc
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **text**
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic *text*
      .replace(/`(.*?)`/g, '$1')       // Remove code `text`
      .replace(/#{1,6}\s*/g, '')       // Remove headers # ## ###
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links [text](url)
      .replace(/\n/g, ', ')            // Replace newlines with commas
      .trim();
  }
  // Fallback: Check parent component set description (for component sets)
  else if (firstComponent.parent && firstComponent.parent.type === 'COMPONENT_SET') {
    const componentSet = firstComponent.parent;
    if ((componentSet as any).description) {
      description = (componentSet as any).description;
    } else if ((componentSet as any).descriptionMarkdown) {
      const markdownDesc = (componentSet as any).descriptionMarkdown;
      description = markdownDesc
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/#{1,6}\s*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n/g, ', ')
        .trim();
    }
  }
  
  
  // Process tags using the new function
  let tagsString = description;
  
  // If no description found, try to extract meaningful tags from the component name
  if (!tagsString && baseName) {
    // Convert component name to tags by splitting on common separators
    const nameTags = baseName
      .split(/[-_\s]+/)
      .map(tag => tag.toLowerCase())
      .filter(tag => tag.length > 0)
      .join(', ');
    
    if (nameTags) {
      tagsString = nameTags;
    }
  }
  
  const tags = processTags(tagsString);
  
  // Process each variant
  const variants: IconVariant[] = [];
  
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    try {
      const fullName = component.name;
      
      // For component sets, try to get variant name from component properties
      let variantName = 'default';
      
      // Check if this component has variant properties
      if (component.variantProperties) {
        const variantProps = component.variantProperties;
        
        // Look for common variant property names
        if (variantProps.Variant) {
          variantName = variantProps.Variant;
        } else if (variantProps.Style) {
          variantName = variantProps.Style;
        } else if (variantProps.Type) {
          variantName = variantProps.Type;
        } else {
          // Use the first property value as variant name
          const propNames = Object.keys(variantProps);
          if (propNames.length > 0) {
            variantName = variantProps[propNames[0]];
          }
        }
      } else {
        // Fallback to parsing component name
        if (fullName.includes('/')) {
          variantName = fullName.split('/')[1];
        } else if (fullName.includes('=')) {
          variantName = fullName.split('=')[1];
        } else if (fullName.includes(' - ')) {
          variantName = fullName.split(' - ')[1];
        } else if (fullName !== baseName) {
          // If the full name is different from base name, use the difference as variant
          variantName = fullName.replace(baseName, '').replace(/^[-_\/=]/, '');
        }
        
        // If we still have the full name, try to extract variant from the end
        if (variantName === fullName && fullName !== baseName) {
          // Try to get the last part after common separators
          const parts = fullName.split(/[-_\/=]/);
          if (parts.length > 1) {
            variantName = parts[parts.length - 1];
          }
        }
      }
      
      // Validate variant name
      if (!ALLOWED_VARIANTS.includes(variantName)) {
        console.warn(`Variant "${variantName}" is not in allowed variants: ${ALLOWED_VARIANTS.join(', ')}`);
      }
      
      // Use SVG_STRING format for better performance and simpler handling
      const svgString = await component.exportAsync({ 
        format: 'SVG_STRING',
        svgOutlineText: true, // Render text as outlines for visual consistency
        svgIdAttribute: false, // Don't include layer names as IDs to reduce file size
        svgSimplifyStroke: true // Simplify strokes for better compatibility
      });
      
      // Validate that we received SVG data
      if (!svgString || svgString.length === 0) {
        throw new Error(`No SVG data received for component ${component.name}`);
      }
      
      // Validate that the SVG string is not empty and contains basic SVG structure
      if (!svgString || !svgString.trim().startsWith('<svg')) {
        throw new Error(`Invalid SVG data received for component ${component.name}`);
      }
      
      // Validate that the SVG is properly closed
      if (!svgString.trim().endsWith('</svg>')) {
        console.warn(`SVG for component ${component.name} may be incomplete - missing closing tag`);
      }
      
      // Deduplicate the SVG to remove any duplicate shapes
      const deduplicatedSvg = deduplicateSVG(svgString);
      
      // Normalize the SVG for consistent output
      const normalizedSvg = normalizeSVG(deduplicatedSvg);
      
      // Validate the SVG
      const validation = validateSVG(normalizedSvg, variantName);
      if (!validation.isValid) {
        console.warn(`SVG validation failed for variant "${variantName}":`, validation.errors);
      }
      
      // Generate hash for the normalized SVG
      const hash = generateHash(normalizedSvg);
      
      if (!hash) {
        console.error(`Failed to generate hash for variant "${variantName}"`);
      }
      
      variants.push({
        variant: variantName,
        svg: normalizedSvg,
        hash: hash
      });
    } catch (error) {
      console.error(`Failed to export variant ${component.name}:`, error);
    }

    // Periodically yield to keep things responsive when there are many variants
    if ((i + 1) % 5 === 0) {
      await yieldToFigma();
    }
  }
  
  // Sort variants alphabetically by variant name
  variants.sort((a, b) => a.variant.localeCompare(b.variant));
  
  return {
    name: toKebabCase(baseName), // Convert to kebab-case
    tags,
    variants
  };
}

/**
 * Saves the icons export data to a JSON file
 */
async function saveIconsExport(iconsData: IconData[]): Promise<void> {
  // Sort icons alphabetically by name
  const sortedIcons = iconsData.sort((a, b) => a.name.localeCompare(b.name));
  
  const exportContent: IconsExport = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    totalIcons: sortedIcons.length,
    icons: sortedIcons
  };

  figma.ui.postMessage({
    type: 'save-icons-export',
    data: {
      content: JSON.stringify(exportContent, null, 2),
      filename: 'icons-export.json'
    }
  });
}

// ============================================================================
// MAIN PLUGIN LOGIC
// ============================================================================

// Main plugin function
figma.showUI(__html__, { width: 280, height: 144, themeColors: true });

// Listen for messages from the UI
figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'export-icons') {
    try {
      await exportIcons();
      figma.ui.postMessage({ type: 'success', message: 'Icons exported successfully!' });
    } catch (error: any) {
      figma.ui.postMessage({ type: 'error', message: `Error: ${error.message}` });
    }
  }
};

async function exportIcons(): Promise<void> {
  // Get the currently viewed page
  const currentPage = figma.currentPage;
  if (!currentPage) {
    throw new Error('No current page found. Please select a page with your icon components.');
  }

  // Send initial status
  figma.ui.postMessage({ 
    type: 'status', 
    message: 'Scanning page for icon components...' 
  });

  // Get all components and component sets from the current page
  const { components, componentSets } = getComponentsFromPage(currentPage);
  
  if (components.length === 0 && componentSets.length === 0) {
    throw new Error(`No components or component sets found on the current page "${currentPage.name}". Please add some icon components to this page.`);
  }

  // Check for duplicate icon names before processing
  const duplicateNames = checkForDuplicateNames(componentSets, components);
  if (duplicateNames.length > 0) {
    const isPlural = duplicateNames.length > 1;
    const duplicateLabel = isPlural ? 'Duplicates' : 'Duplicate';
    const errorMessage = `${duplicateLabel}: ${duplicateNames.join(', ')}`;
    
    // Use Figma's notification system to show the error
    figma.notify(errorMessage, { error: true, timeout: 10000 });
    return;
  }
  
  // Calculate total items to process
  const totalItems = componentSets.length + components.length;
  
  // Send progress update with total count
  figma.ui.postMessage({ 
    type: 'status', 
    message: `Found ${totalItems} icon components to process...` 
  });
  

  const iconsData: IconData[] = [];
  let processedCount = 0;

  // Process component sets first (these are the main icon groups)
  figma.ui.postMessage({ 
    type: 'status', 
    message: `Processing ${componentSets.length} component sets...` 
  });
  
  for (let index = 0; index < componentSets.length; index++) {
    const componentSet = componentSets[index];
    try {
      const setName = (componentSet as any).name;
      
      // Update status for current item being processed
      figma.ui.postMessage({ 
        type: 'progress', 
        message: `Processing component set: ${setName} (${processedCount + 1}/${componentSets.length})` 
      });
      
      // Get all variant components from this set
      const variantComponents: ComponentNode[] = [];
      if ('children' in componentSet) {
        for (const child of componentSet.children) {
          if (child.type === 'COMPONENT') {
            variantComponents.push(child as ComponentNode);
          }
        }
      }
      
      if (variantComponents.length > 0) {
        const iconData = await processIconGroup(setName, variantComponents);
        iconsData.push(iconData);
        processedCount++;
        
        // Update progress with percentage
        const percentage = Math.round((processedCount / componentSets.length) * 50); // 50% for component sets
        figma.ui.postMessage({ 
          type: 'progress', 
          message: `Processed ${processedCount}/${componentSets.length} component sets (${percentage}%)` 
        });
      }
    } catch (error) {
      console.error(`Failed to process component set ${(componentSet as any).name}:`, error);
    }

    // Yield every few component sets to keep the Figma tab responsive
    if ((index + 1) % 3 === 0) {
      await yieldToFigma();
    }
  }

  // Process individual components (not part of component sets)
  // First, collect all component IDs that are already part of component sets
  const processedComponentIds = new Set<string>();
  for (const componentSet of componentSets) {
    if ('children' in componentSet) {
      for (const child of componentSet.children) {
        if (child.type === 'COMPONENT') {
          processedComponentIds.add((child as any).id);
        }
      }
    }
  }
  
  // Filter out components that are already part of component sets
  const individualComponents = components.filter(comp => !processedComponentIds.has((comp as any).id));
  
  if (individualComponents.length > 0) {
    figma.ui.postMessage({ 
      type: 'status', 
      message: `Processing ${individualComponents.length} individual components...` 
    });
    
    const iconGroups = groupComponentsByBaseName(individualComponents);

    const totalGroups = Object.keys(iconGroups).length;
    let individualProcessedCount = 0;

    const entries = Object.entries(iconGroups);

    for (let i = 0; i < entries.length; i++) {
      const [baseName, componentGroup] = entries[i];
      try {
        
        // Update status for current group being processed
        figma.ui.postMessage({ 
          type: 'progress', 
          message: `Processing group: ${baseName} (${individualProcessedCount + 1}/${totalGroups})` 
        });
        
        const iconData = await processIconGroup(baseName, componentGroup);
        iconsData.push(iconData);
        processedCount++;
        individualProcessedCount++;
        
        // Update progress with percentage (50-90% for individual components)
        const basePercentage = 50; // Start from 50%
        const individualPercentage = Math.round((individualProcessedCount / totalGroups) * 40); // 40% for individual components
        const totalPercentage = basePercentage + individualPercentage;
        
        figma.ui.postMessage({ 
          type: 'progress', 
          message: `Processed ${individualProcessedCount}/${totalGroups} individual groups (${totalPercentage}%)` 
        });
      } catch (error) {
        console.error(`Failed to process icon group ${baseName}:`, error);
        // Continue with other groups even if one fails
      }

      // Yield periodically so large numbers of individual components
      // don't lock up the Figma UI.
      if ((i + 1) % 5 === 0) {
        await yieldToFigma();
      }
    }
  }

  // Generate and save the complete icons export
  
  figma.ui.postMessage({ 
    type: 'status', 
    message: 'Generating JSON export file...' 
  });
  
  figma.ui.postMessage({ 
    type: 'progress', 
    message: 'Generating JSON export (90%)' 
  });
  
  await saveIconsExport(iconsData);

  // Send final progress update
  figma.ui.postMessage({ 
    type: 'progress', 
    message: 'Export complete (100%)' 
  });

  // Send final success message
  figma.ui.postMessage({ 
    type: 'success', 
    message: `Successfully exported ${iconsData.length} icons` 
  });

}



