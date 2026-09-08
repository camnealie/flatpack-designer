import type { Part } from './types';

/**
 * Generate a shelf part.
 * Shelf width = unit width - 2 × material thickness (to fit between uprights)
 * Shelf depth = unit depth
 */
export function generateShelf(
  unitWidth: number,
  unitDepth: number,
  thickness: number,
  index: number,
  type: 'adjustable' | 'fixed-top' | 'fixed-bottom'
): Part {
  // Shelf fits between the two uprights
  const width = unitWidth - 2 * thickness;
  const height = unitDepth; // "height" when laid flat = depth

  let name: string;
  let id: string;

  switch (type) {
    case 'fixed-top':
      name = 'Fixed Top';
      id = 'shelf-fixed-top';
      break;
    case 'fixed-bottom':
      name = 'Fixed Bottom';
      id = 'shelf-fixed-bottom';
      break;
    default:
      name = `Adjustable Shelf ${index + 1}`;
      id = `shelf-adjustable-${index}`;
  }

  return {
    id,
    name,
    width,
    height,
    thickness,
    holes: [], // Adjustable shelves don't need holes
    grooves: [],
  };
}

/**
 * Generate all shelves based on configuration.
 */
export function generateShelves(
  unitWidth: number,
  unitDepth: number,
  thickness: number,
  adjustableCount: number,
  hasFixedTop: boolean,
  hasFixedBottom: boolean
): Part[] {
  const parts: Part[] = [];

  // Fixed top shelf
  if (hasFixedTop) {
    parts.push(generateShelf(unitWidth, unitDepth, thickness, 0, 'fixed-top'));
  }

  // Fixed bottom shelf
  if (hasFixedBottom) {
    parts.push(generateShelf(unitWidth, unitDepth, thickness, 0, 'fixed-bottom'));
  }

  // Adjustable shelves
  for (let i = 0; i < adjustableCount; i++) {
    parts.push(generateShelf(unitWidth, unitDepth, thickness, i, 'adjustable'));
  }

  return parts;
}
