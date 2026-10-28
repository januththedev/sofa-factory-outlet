import { describe, expect, it } from 'vitest';
import { isTrackedPath } from '@/lib/analytics/client';

describe('isTrackedPath', () => {
  it('tracks public pages', () => {
    for (const path of ['/', '/shop/', '/sofas/l-shape/', '/product/some-sofa/', '/book-visit/', '/book-visit/done/SFO-B-1001/']) {
      expect(isTrackedPath(path), path).toBe(true);
    }
  });

  it('never tracks the admin panel or API routes', () => {
    for (const path of ['/admin', '/admin/', '/admin/bookings/12/', '/api/health/', '/api']) {
      expect(isTrackedPath(path), path).toBe(false);
    }
  });

  it('does not mistake a public page that starts with the same letters for the admin', () => {
    expect(isTrackedPath('/administration/')).toBe(true);
    expect(isTrackedPath('/apiary/')).toBe(true);
  });
});
