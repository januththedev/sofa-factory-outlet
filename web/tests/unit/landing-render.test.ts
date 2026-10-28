import type { ComponentProps } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { vi } from 'vitest';
import { Collections } from '@/components/landing/collections';
import { ColourExplorer } from '@/components/landing/colour-explorer';
import { CountUp } from '@/components/landing/count-up';
import { FactoryStory } from '@/components/landing/factory-story';
import { Visit } from '@/components/landing/visit';
import type { Swatch } from '@/lib/catalogue/cached';

vi.mock('@gsap/react', () => ({ useGSAP: () => {} }));
vi.mock('@/lib/motion/gsap', () => ({
  gsap: {},
  ScrollTrigger: {},
  MOTION_DESKTOP: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
}));
vi.mock('@/components/picture', () => ({ Picture: () => null }));
vi.mock('@/components/site/transition', () => ({
  TLink: ({ children, ...props }: ComponentProps<'a'>) => createElement('a', props, children),
}));
vi.mock('@/components/site/magnetic', () => ({
  Magnetic: ({ children }: { children: ReactNode }) => createElement('span', null, children),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

describe('landing server-rendered fallbacks', () => {
  it('renders final counters even for inactive desktop steps without JavaScript', () => {
    const fabric = renderToStaticMarkup(createElement(CountUp, { value: 1000, suffix: '+', active: false }));
    const delivery = renderToStaticMarkup(createElement(CountUp, { value: 10, suffix: '–15', active: false }));
    expect(fabric).toContain('>1,000+</span>');
    expect(fabric).not.toContain('>0+</span>');
    expect(delivery).toContain('>10–15</span>');
    expect(delivery).not.toContain('>0–15</span>');
  });

  it('keeps all four factory steps and their factual values in the HTML', () => {
    const html = renderToStaticMarkup(createElement(FactoryStory));
    for (const title of ['Frame', 'Foam', 'Fabric', 'Finish']) {
      expect(html).toContain(title);
    }
    expect(html).toContain('1,000+');
    expect(html).toContain('10–15');
    expect(html).toContain('Warranty and delivery terms are confirmed at your visit.');
    expect(html).toContain('Swipe or scroll to explore');
  });

  it('offers the whole shop and showroom when there are no collection tiles', () => {
    const html = renderToStaticMarkup(createElement(Collections, { tiles: [] }));
    expect(html).toContain('href="/shop/"');
    expect(html).toContain('See everything');
    expect(html).toContain('href="/book-visit/"');
  });

  it('renders an address and map actions without requesting a third-party iframe', () => {
    const html = renderToStaticMarkup(createElement(Visit, {
      picture: null,
      address: { street: 'Test street', locality: 'Test locality', city: 'Test city' },
      hoursLines: null,
      mapSrc: 'https://maps.example.test/embed',
      directionsUrl: 'https://maps.example.test/directions',
      whatsappUrl: null,
    }));
    expect(html).toContain('Test street');
    expect(html).toContain('Show the map');
    expect(html).toContain('Open in Maps');
    expect(html).toContain('Get directions');
    expect(html).toContain('Book a visit');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('https://maps.example.test/embed');
  });

  it('renders the flat sofa and an announced, keyboard-selectable colour before hydration', () => {
    const swatches: Swatch[] = [
      { family: 'green', label: 'Green', hex: '#336644', count: 2, href: '/shop/?colour=green' },
      { family: 'blue', label: 'Blue', hex: '#335577', count: 1, href: '/shop/?colour=blue' },
    ];
    const html = renderToStaticMarkup(createElement(ColourExplorer, { swatches }));
    expect(html).toContain('Illustration of a three-seater sofa');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true" aria-label="Green"');
    expect(html).toContain('aria-checked="false" aria-label="Blue"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Shop this colour');
    expect(html).not.toContain('<canvas');
  });

  it('omits the explorer when the catalogue has no swatches', () => {
    expect(renderToStaticMarkup(createElement(ColourExplorer, { swatches: [] }))).toBe('');
  });
});
