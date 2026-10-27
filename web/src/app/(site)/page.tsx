import { Picture } from '@/components/picture';
import { listPublishedProducts } from '@/lib/catalogue/queries';
import { formatLkr } from '@/lib/money';

// Phase 1 placeholder: proves the database, seed and image pipeline end to end.
// Replaced by the landing page in Phase 2.
export default async function HomePage() {
  const products = await listPublishedProducts();
  return (
    <main className="site-container py-16">
      <p className="eyebrow">Rebuild in progress</p>
      <h1 className="mt-3 text-5xl sm:text-7xl">Sofa Factory Outlet</h1>
      <p className="mt-4 max-w-xl text-mute">{products.length} published pieces from the site capture.</p>
      <ul className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {products.map((p, index) => (
          <li key={p.id}>
            <a href={p.href} className="group block">
              <div className="aspect-square overflow-hidden rounded-[var(--radius-card)] bg-bone-2">
                {p.image ? (
                  <Picture
                    data={p.image}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    priority={index < 4}
                    imgClassName="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <p className="mt-3 font-medium">{p.name}</p>
              <p className="text-sm text-mute">
                {p.colours[0]?.name} · {p.priceMinor ? `${p.priceFrom ? 'From ' : ''}${formatLkr(p.priceMinor)}` : 'Price on request'}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
