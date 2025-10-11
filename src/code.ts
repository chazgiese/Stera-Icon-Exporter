// This file contains the main plugin code that runs in Figma
// It will be compiled to code.js

interface IconVariant {
  variant: string;
  svg: string;
}

interface IconData {
  name: string;
  tags: string;
  variants: IconVariant[];
}

interface IconsExport {
  icons: IconData[];
  exportedAt: string;
  totalIcons: number;
}

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
  console.log(`Found ${components.length} components and ${componentSets.length} component sets on current page: "${currentPage.name}"`);
  
  if (components.length === 0 && componentSets.length === 0) {
    throw new Error(`No components or component sets found on the current page "${currentPage.name}". Please add some icon components to this page.`);
  }
  
  // Calculate total items to process
  const totalItems = componentSets.length + components.length;
  
  // Send progress update with total count
  figma.ui.postMessage({ 
    type: 'status', 
    message: `Found ${totalItems} icon components to process...` 
  });
  
  // Log component names for debugging
  components.forEach((comp, index) => {
    console.log(`Component ${index + 1}: ${(comp as any).name}`);
  });

  const iconsData: IconData[] = [];
  let processedCount = 0;

  // Process component sets first (these are the main icon groups)
  figma.ui.postMessage({ 
    type: 'status', 
    message: `Processing ${componentSets.length} component sets...` 
  });
  
  for (const componentSet of componentSets) {
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
  console.log(`Found ${individualComponents.length} individual components (not part of component sets)`);
  
  if (individualComponents.length > 0) {
    figma.ui.postMessage({ 
      type: 'status', 
      message: `Processing ${individualComponents.length} individual components...` 
    });
    
    const iconGroups = groupComponentsByBaseName(individualComponents);
    console.log(`Grouped individual components into ${Object.keys(iconGroups).length} icon groups`);

    const totalGroups = Object.keys(iconGroups).length;
    let individualProcessedCount = 0;

    for (const [baseName, componentGroup] of Object.entries(iconGroups)) {
      try {
        console.log(`Processing individual component group: ${baseName} with ${componentGroup.length} variants`);
        
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
    }
  }

  // Generate and save the complete icons export
  console.log(`Generating icons export with ${iconsData.length} icon groups`);
  
  figma.ui.postMessage({ 
    type: 'status', 
    message: 'Generating JSON export file...' 
  });
  
  figma.ui.postMessage({ 
    type: 'progress', 
    message: 'Generating JSON export (90%)' 
  });
  
  await saveIconsExport(iconsData);
  console.log('Icons export generated and sent to UI');

  // Send final progress update
  figma.ui.postMessage({ 
    type: 'progress', 
    message: 'Export complete (100%)' 
  });

  // Send final success message
  figma.ui.postMessage({ 
    type: 'success', 
    message: `Successfully exported ${iconsData.length} icon groups with all variants!` 
  });

  console.log(`Exported ${iconsData.length} icon groups successfully!`);
}


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

function groupComponentsByBaseName(components: ComponentNode[]): { [baseName: string]: ComponentNode[] } {
  const groups: { [baseName: string]: ComponentNode[] } = {};
  
  components.forEach(component => {
    const name = (component as any).name;
    
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
 * Deduplicates *exact* duplicate leaf shapes in an SVG string.
 * Safe-by-default: only removes elements proven visually redundant.
 * Works in Figma plugin (no DOM).
 */
function deduplicateSVG(svgString: string): string {
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

    // Tags we consider for dedupe (leaf shapes)
    const SHAPE_TAGS = new Set([
      'path','rect','circle','ellipse','line','polyline','polygon'
    ]);

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
      const riskyAttrs = [
        'id','class','style','filter','mask','clip-path','clipPath','transform'
      ];
      if (riskyAttrs.some(k => a[k] != null)) return false;
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

    if (removed > 0) {
      console.log(`[deduplicateSVG] removed ${removed} duplicate element(s)`);
    }

    return `${svgOpen}\n${out.join('\n')}\n${svgClose}`;
  } catch (err) {
    console.error('[deduplicateSVG] error', err);
    return svgString;
  }
}

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
  
  // Log which method was used to get the description
  if (description) {
    if ((firstComponent as any).description) {
      console.log(`Component "${baseName}" - Using plain text description: "${description}"`);
    } else if ((firstComponent as any).descriptionMarkdown) {
      console.log(`Component "${baseName}" - Using markdown description: "${description}"`);
    } else if (firstComponent.parent && firstComponent.parent.type === 'COMPONENT_SET') {
      console.log(`Component "${baseName}" - Using parent component set description: "${description}"`);
    }
  } else {
    console.log(`Component "${baseName}" - No description found`);
    
    // Debug: Log available properties when no description is found
    console.log(`Available properties on component "${baseName}":`, Object.keys(firstComponent));
    console.log(`Component type:`, firstComponent.type);
    
    // Log parent properties if available
    if (firstComponent.parent) {
      console.log(`Parent type:`, firstComponent.parent.type);
      console.log(`Parent properties:`, Object.keys(firstComponent.parent));
    }
  }
  
  let tags = description
    .split(',')
    .map((tag: string) => tag.trim())
    .filter((tag: string) => tag.length > 0)
    .join(', ');
  
  // If no description found, try to extract meaningful tags from the component name
  if (!tags && baseName) {
    // Convert component name to tags by splitting on common separators
    const nameTags = baseName
      .split(/[-_\s]+/)
      .map(tag => tag.toLowerCase())
      .filter(tag => tag.length > 0)
      .join(', ');
    
    if (nameTags) {
      tags = nameTags;
      console.log(`Using component name as tags for "${baseName}": "${tags}"`);
    }
  }
  
  // Process each variant
  const variants: IconVariant[] = [];
  
  for (const component of components) {
    try {
      const fullName = (component as any).name;
      
      // For component sets, try to get variant name from component properties
      let variantName = 'default';
      
      // Check if this component has variant properties
      if ((component as any).variantProperties) {
        const variantProps = (component as any).variantProperties;
        
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
      
      const svgData = await (component as any).exportAsync({ format: 'SVG' });
      const svgString = String.fromCharCode.apply(null, Array.from(svgData));
      
      // Deduplicate the SVG to remove any duplicate shapes
      const deduplicatedSvg = deduplicateSVG(svgString);
      
      variants.push({
        variant: variantName,
        svg: deduplicatedSvg
      });
    } catch (error) {
      console.error(`Failed to export variant ${(component as any).name}:`, error);
    }
  }
  
  return {
    name: baseName,
    tags,
    variants
  };
}

async function saveIconsExport(iconsData: IconData[]): Promise<void> {
  // Sort icons alphabetically by name
  const sortedIcons = iconsData.sort((a, b) => a.name.localeCompare(b.name));
  
  const exportContent: IconsExport = {
    icons: sortedIcons,
    exportedAt: new Date().toISOString(),
    totalIcons: sortedIcons.length
  };

  figma.ui.postMessage({
    type: 'save-icons-export',
    data: {
      content: JSON.stringify(exportContent, null, 2),
      filename: 'icons-export.json'
    }
  });
}

