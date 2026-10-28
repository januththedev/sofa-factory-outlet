import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 90, background: '#f3eee4', color: '#641f2b', borderBottom: '24px solid #641f2b' }}><div style={{ fontSize: 34, letterSpacing: 8, textTransform: 'uppercase' }}>Sofa Factory Outlet</div><div style={{ marginTop: 28, fontSize: 78, color: '#241c19' }}>Made for your living room.</div></div>, size);
}
