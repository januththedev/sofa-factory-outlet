import type { ReactNode } from 'react';

// CONTRACT STUB. Owner: "colour-engine" agent. Keep the export name and props.
// Server component: asks suggestFor() for pieces that go with `anchors` and renders them
// as tiles, each with the one-line reason from the colour engine. Renders nothing when there are none.
export async function CompleteTheLook(props: { anchors: Array<{ productId: number; variantId?: number }>; heading?: string; limit?: number }): Promise<ReactNode> {
  void props;
  return null;
}
