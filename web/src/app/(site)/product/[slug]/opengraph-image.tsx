import { ImageResponse } from 'next/og';
import { productBySlug } from '@/lib/catalogue/product';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const product = await productBySlug((await params).slug);
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 82, background: '#f3eee4', color: '#241c19', borderLeft: '24px solid #641f2b' }}>
      <div style={{ fontSize: 28, color: '#641f2b', textTransform: 'uppercase', letterSpacing: 5 }}>{product?.category.name ?? 'Furniture'}</div>
      <div style={{ fontSize: 76, lineHeight: 1.05 }}>{product?.name ?? 'Sofa Factory Outlet'}</div>
      <div style={{ fontSize: 32, color: '#641f2b' }}>Sofa Factory Outlet</div>
    </div>,
    size,
  );
}
