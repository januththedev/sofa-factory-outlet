import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { processImage } from '@/lib/images/process';

export const dynamic = 'force-dynamic';

const metadataSchema = z.object({
  kind: z.enum(['products', 'categories']),
  id: z.string().trim().regex(/^[a-z0-9-]+$/u),
  alt: z.string().trim().max(300).default(''),
  flag: z.enum(['borrowed', 'licence']).optional(),
});

const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxBytes = 12 * 1024 * 1024;
const filesSchema = z.array(z.instanceof(File))
  .min(1, 'Choose at least one file.')
  .max(12, 'Choose no more than 12 files.')
  .refine(
    (files) => files.every((file) => accepted.has(file.type) && file.size <= maxBytes),
    'Each file must be JPEG, PNG, WebP or AVIF and no larger than 12 MB.',
  );

export async function POST(request: Request): Promise<Response> {
  const session = await requireRole('any');
  const form = await request.formData();
  const metadata = metadataSchema.safeParse({
    kind: form.get('kind'),
    id: form.get('id'),
    alt: form.get('alt') ?? '',
    flag: form.get('flag') || undefined,
  });
  if (!metadata.success) {
    return Response.json({ ok: false, error: 'Invalid upload details.' }, { status: 400 });
  }
  if (metadata.data.kind === 'categories' && session.role !== 'owner') {
    return Response.json({ ok: false, error: 'Only an owner can change category images.' }, { status: 403 });
  }
  const files = filesSchema.safeParse(form.getAll('files'));
  if (!files.success) {
    return Response.json({ ok: false, error: files.error.issues[0]?.message }, { status: 400 });
  }
  try {
    const images = await Promise.all(files.data.map(async (file) => processImage(
      Buffer.from(await file.arrayBuffer()),
      {
        keyPrefix: `${metadata.data.kind}/${metadata.data.id}`,
        alt: metadata.data.alt,
        flag: metadata.data.flag,
        source: file.name,
      },
    )));
    return Response.json({ ok: true, images });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'The photos could not be processed.',
    }, { status: 422 });
  }
}
