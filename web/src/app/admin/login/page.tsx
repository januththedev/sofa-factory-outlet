import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { CardBody } from '@/components/ui/card';
import { sanitiseNext } from '@/lib/auth/paths';
import { getSession } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  // Only same-origin /admin/... paths survive; anything else becomes the dashboard.
  const target = sanitiseNext(Array.isArray(next) ? next[0] : next);
  if (await getSession()) redirect(target);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="Sofa Factory Outlet" width={512} height={512}
            className="mx-auto h-14 w-14" />
          <p className="eyebrow mt-4">Sofa Factory Outlet</p>
          <h1 className="mt-1 font-display text-3xl">Admin sign-in</h1>
        </div>
        <Card className="min-w-0">
          <CardBody>
            <LoginForm next={target} />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
