import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { formatCounterText } from '@/components/landing/counter-text';
import { shouldUse3d } from '@/components/landing/device-capabilities';
import { railProgress } from '@/components/landing/rail-progress';

describe('landing device capabilities', () => {
  const capable = { finePointer: true, hasTouch: false, hardwareConcurrency: 8, deviceMemory: 8 };

  it('keeps 3D for a capable fine pointer', () => {
    expect(shouldUse3d(capable)).toBe(true);
  });

  it('uses the flat preview on touch, including a laptop with a mouse and touchscreen', () => {
    expect(shouldUse3d({ ...capable, hasTouch: true })).toBe(false);
    expect(shouldUse3d({ ...capable, finePointer: false, hasTouch: true })).toBe(false);
  });

  it('requires a fine pointer even when no touchscreen is reported', () => {
    expect(shouldUse3d({ ...capable, finePointer: false })).toBe(false);
  });

  it.each([0, 1, 2, 4])('uses the flat preview with %i logical processors', (hardwareConcurrency) => {
    expect(shouldUse3d({ ...capable, hardwareConcurrency })).toBe(false);
  });

  it.each([0.25, 0.5, 1, 2, 4])('uses the flat preview with %s GB of device memory', (deviceMemory) => {
    expect(shouldUse3d({ ...capable, deviceMemory })).toBe(false);
  });

  it('accepts hardware above both thresholds', () => {
    expect(shouldUse3d({ ...capable, hardwareConcurrency: 5, deviceMemory: 5 })).toBe(true);
  });

  it('allows browsers without optional hardware hints', () => {
    expect(shouldUse3d({ finePointer: true, hasTouch: false })).toBe(true);
    expect(shouldUse3d({ finePointer: true, hasTouch: false, hardwareConcurrency: 8 })).toBe(true);
    expect(shouldUse3d({ finePointer: true, hasTouch: false, deviceMemory: 8 })).toBe(true);
  });

  it('honours either low-end hint when the other is unavailable', () => {
    expect(shouldUse3d({ finePointer: true, hasTouch: false, hardwareConcurrency: 4 })).toBe(false);
    expect(shouldUse3d({ finePointer: true, hasTouch: false, deviceMemory: 4 })).toBe(false);
  });
});

describe('counter final text', () => {
  it('renders the actual fabric and delivery claims before any animation', () => {
    expect(formatCounterText(1000, '', '+')).toBe('1,000+');
    expect(formatCounterText(10, '', '–15')).toBe('10–15');
    expect(formatCounterText(10, '', '-year')).toBe('10-year');
  });

  it('preserves a real zero and formats prefixes and rounded animation frames', () => {
    expect(formatCounterText(0)).toBe('0');
    expect(formatCounterText(1234.6, 'Over ', '+')).toBe('Over 1,235+');
  });
});

describe('native rail progress', () => {
  it('follows the scrollable distance from start to finish', () => {
    expect(railProgress(0, 1200, 400)).toBe(0);
    expect(railProgress(400, 1200, 400)).toBe(0.5);
    expect(railProgress(800, 1200, 400)).toBe(1);
  });

  it('clamps scroll bounce at both edges', () => {
    expect(railProgress(-40, 1200, 400)).toBe(0);
    expect(railProgress(900, 1200, 400)).toBe(1);
  });

  it('marks a rail that fits its viewport as complete', () => {
    expect(railProgress(0, 400, 400)).toBe(1);
    expect(railProgress(0, 200, 400)).toBe(1);
    expect(railProgress(0, 0, 0)).toBe(1);
  });

  it('recalculates when the viewport is resized', () => {
    expect(railProgress(400, 1200, 400)).toBe(0.5);
    expect(railProgress(400, 1200, 800)).toBe(1);
  });
});
