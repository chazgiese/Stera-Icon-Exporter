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
figma.showUI(__html__, { width: 300, height: 200 });

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

async function processIconGroup(baseName: string, components: ComponentNode[]): Promise<IconData> {
  // Get tags from the first component (they should be the same for all variants)
  const firstComponent = components[0];
  const description = (firstComponent as any).description || '';
  const tags = description
    .split(',')
    .map((tag: string) => tag.trim())
    .filter((tag: string) => tag.length > 0)
    .join(', ');
  
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
      
      variants.push({
        variant: variantName,
        svg: svgString
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
