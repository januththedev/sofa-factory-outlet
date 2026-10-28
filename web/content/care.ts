export const CARE_NOTES: Record<string, string[]> = {
  velvet: ['Vacuum gently with a soft upholstery attachment.', 'Blot spills promptly with a clean, dry cloth; avoid rubbing the pile.'],
  leather: ['Dust with a soft, dry cloth and wipe spills promptly.', 'Use only a leather-care product suitable for the exact finish.'],
  corduroy: ['Vacuum along the ribs with a soft upholstery attachment.', 'Blot spills promptly and avoid scrubbing the textured surface.'],
  fabric: ['Vacuum regularly with a soft upholstery attachment.', 'Blot spills promptly and follow the care label for any deeper cleaning.'],
};

export const VISIT_CONFIRMATION = 'Delivery and warranty are confirmed at your visit.';

export function careNotesFor(material: string | null): string[] {
  return [...(material ? (CARE_NOTES[material] ?? CARE_NOTES.fabric) : CARE_NOTES.fabric), VISIT_CONFIRMATION];
}
