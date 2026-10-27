import { describe, expect, it } from 'vitest';
import { classifyHex, hexToOklch, nearestFamily } from '@/lib/colour/classify';
import { findColourPhrase } from '@/lib/colour/dictionary';
import { cleanAlt, deriveColour, deriveMaterial, deriveSeats, deriveShape, generatedAlt } from '@/lib/seed/derive';

describe('facet derivation', () => {
  it('reads shapes', () => {
    expect(deriveShape(['Dusty Pink L-Shape Sofa'])).toBe('l-shape');
    expect(deriveShape(['U-Shape Modular Sofa in Caramel Brown'])).toBe('u-shape');
    expect(deriveShape(['Grey Fabric Sofa Set 3+2+1 with Coffee Table'])).toBe('set');
    expect(deriveShape(['Premium Light Blue L Shape Sofa'])).toBe('l-shape');
    expect(deriveShape(['Camaleonda'])).toBeNull();
  });

  it('reads materials, falling back through the sources in order', () => {
    expect(deriveMaterial(['Maroon Leather Sofa Set'])).toBe('leather');
    expect(deriveMaterial(['Luxury Emerald Green L-Shape Sofa', '', 'Emerald-Green-Velvet-L-Shape-Chaise'])).toBe('velvet');
    expect(deriveMaterial(['Beige Corduroy L-Shape Sofa'])).toBe('corduroy');
  });

  it('reads seat counts', () => {
    expect(deriveSeats(['Grey Fabric Sofa Set 3+2+1'])).toBe(6);
    expect(deriveSeats(['deep blue fabric 7 seater sofa set'])).toBe(7);
    expect(deriveSeats(['Charles'])).toBeNull();
  });

  it('finds the longest colour phrase', () => {
    expect(findColourPhrase('Luxury Emerald Green L-Shape Sofa')?.name).toBe('Emerald green');
    expect(findColourPhrase('U-Shape Modular Sofa in Caramel Brown')?.name).toBe('Caramel brown');
    expect(findColourPhrase('Dual-Tone Velvet Sofa Set')?.family).toBe('multi');
    expect(findColourPhrase('Chesterfield L-Shape Sofa Set')).toBeNull();
  });

  it('derives a classified colour, or falls back to the photo', () => {
    const named = deriveColour(['Luxury Emerald Green L-Shape Sofa']);
    expect(named).toMatchObject({ name: 'Emerald green', family: 'green', fromPhoto: false });
    const fromPhoto = deriveColour(['Charles'], '#8A8D91');
    expect(fromPhoto).toMatchObject({ family: 'grey', fromPhoto: true });
  });

  it('cleans SEO alt text and rejects placeholders', () => {
    expect(
      cleanAlt(
        'Dusty pink L-shape sectional sofa with chaise and plump back cushions in a modern living room setup — contemporary sofa available at factory price in Colombo, Sri Lanka',
      ),
    ).toBe('Dusty pink L-shape sectional sofa with chaise and plump back cushions in a modern living room setup');
    expect(cleanAlt('Bed Sheet')).toBeNull();
    expect(cleanAlt('bebitalia_table_Seven_Sofa_factory_outlet')).toBeNull();
    expect(cleanAlt('')).toBeNull();
  });

  it('generates alt text from product data', () => {
    expect(generatedAlt({ colourName: 'Emerald green', material: 'velvet', shape: 'l-shape', categoryNoun: 'sofa', name: 'X' })).toBe(
      'Emerald green velvet L-shape sofa',
    );
    expect(generatedAlt({ categoryNoun: 'table', name: 'Seven' })).toBe('Seven table');
  });
});

describe('colour classification', () => {
  it('names families, tones and warmth', () => {
    expect(classifyHex('#1F5E46')).toEqual({ family: 'green', tone: 'dark', warmth: 'cool' });
    expect(classifyHex('#EDE3D1')).toMatchObject({ family: 'cream', tone: 'light', warmth: 'neutral' });
    expect(classifyHex('#6B1F2A')).toMatchObject({ family: 'maroon', tone: 'dark', warmth: 'warm' });
    expect(classifyHex('#D4A72C')).toMatchObject({ family: 'mustard', warmth: 'warm' });
    expect(nearestFamily('#1F2A44')).toBe('navy');
    expect(nearestFamily('#9A9B9D')).toBe('grey');
  });

  it('computes OKLCH', () => {
    const white = hexToOklch('#FFFFFF');
    expect(white.L).toBeCloseTo(1, 3);
    expect(white.C).toBeLessThan(0.001);
  });
});
