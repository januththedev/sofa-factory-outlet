import { Children } from 'react';
import { cloneElement } from 'react';
import { isValidElement } from 'react';
import { cn } from '@/lib/cn';

const control = [
  'min-h-11 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink',
  'placeholder:text-mute/70 outline-none transition-colors focus:border-maroon',
  'focus:ring-2 focus:ring-maroon/15 disabled:opacity-60 aria-[invalid=true]:border-bad',
].join(' ');

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-ink-2', className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(control, 'resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'appearance-none pr-10', className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-bad">
      <span className="font-semibold">Error: </span>
      {children}
    </p>
  );
}

/** Label + control + hint/error; existing descriptions and form refs are preserved. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const descriptionId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {Children.map(children, (child) => {
        if (!isValidElement<React.InputHTMLAttributes<HTMLInputElement>>(child)) return child;
        const nativeControl = child.type === 'input' || child.type === 'select' || child.type === 'textarea';
        const sharedControl = child.type === Input || child.type === Select || child.type === Textarea;
        if (child.props.id !== htmlFor && !nativeControl && !sharedControl) return child;
        const describedBy = [child.props['aria-describedby'], descriptionId].filter(Boolean).join(' ');
        return cloneElement(child, {
          id: child.props.id ?? htmlFor,
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? true : child.props['aria-invalid'],
        });
      })}
      {hint && !error ? <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-mute">{hint}</p> : null}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
    </div>
  );
}
