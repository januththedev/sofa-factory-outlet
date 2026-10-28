import { Badge } from '@/components/ui/badge';
import type { ServiceStatus } from '@/lib/admin/stats';

/** Which optional services have keys. Shows whether each is set, never the value. */
export function ServicesCard({ services }: { services: ServiceStatus[] }) {
  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6"
    >
      <h2 id="services-title" className="font-display text-2xl">
        Connected services
      </h2>
      <p className="mt-1 max-w-2xl text-base sm:text-sm text-mute">
        Keys are set as environment variables on the host, not here, so they never pass through this page. Add or
        change them in the hosting dashboard, then redeploy.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {services.map((service) => (
          <li key={service.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3">
            <div className="min-w-0">
              <p className="font-medium">{service.label}</p>
              <p className="text-base sm:text-sm text-mute">{service.effect}</p>
              {service.configured ? null : (
                <p className="mt-1 text-xs text-mute">
                  Set: <span className="font-mono">{service.vars.join(', ')}</span>
                </p>
              )}
            </div>
            <Badge tone={service.configured ? 'good' : 'warn'}>
              {service.configured ? 'Connected' : 'Not connected'}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
