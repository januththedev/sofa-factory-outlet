import { cn } from '@/lib/cn';

const control = [
  'w-full scroll-mb-32 rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink',
  'placeholder:text-mute/70 outline-none transition-colors focus:border-maroon focus:ring-2',
  'focus:ring-maroon/15 disabled:opacity-60 aria-[invalid=true]:border-bad',
].join(' ');

export function TextInput({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}

export function TextArea({ className, rows = 3, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(control, 'resize-y', className)} {...props} />;
}

export const fieldId = (name: string) => `bv-${name}`;
const describedByFor = (id: string, hint?: string, error?: string) => [
  hint ? `${id}-hint` : null,
  error ? `${id}-error` : null,
].filter(Boolean).join(' ') || undefined;

export type ControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
};

function Messages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint ? <p id={`${id}-hint`} className="mt-2 text-base text-mute">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-2 text-base text-bad">{error}</p> : null}
    </>
  );
}

const labelClass = 'mb-2 block text-base font-medium text-ink-2';
const Optional = () => <span className="font-normal text-mute"> (optional)</span>;

type FieldProps = {
  name: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: (control: ControlProps) => React.ReactNode;
};

export function Field({ name, label, optional, hint, error, className, children }: FieldProps) {
  const id = fieldId(name);
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional ? <Optional /> : null}
      </label>
      {children({ id, 'aria-describedby': describedByFor(id, hint, error), 'aria-invalid': error ? true : undefined })}
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

type GroupProps = Omit<FieldProps, 'label' | 'children'> & {
  legend: string;
  onBlur?: React.FocusEventHandler<HTMLFieldSetElement>;
  children: React.ReactNode;
};

export function Group({ name, legend, optional, hint, error, className, children, onBlur }: GroupProps) {
  const id = fieldId(name);
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      onBlur={onBlur}
      aria-describedby={describedByFor(id, hint, error)}
      className={cn('min-w-0 scroll-mb-32 outline-none', className)}
    >
      <legend className={cn(labelClass, 'p-0')}>
        {legend}
        {optional ? <Optional /> : null}
      </legend>
      {children}
      <Messages id={id} hint={hint} error={error} />
    </fieldset>
  );
}

type SwitchProps = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
};

export function Switch({ id, checked, disabled, onChange, label, hint }: SwitchProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          'relative inline-flex min-h-11 cursor-pointer items-center gap-3',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className={[
            'relative h-6 w-11 shrink-0 rounded-full bg-ink/25 transition-colors',
            'after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-paper',
            'after:transition-transform peer-checked:bg-maroon peer-checked:after:translate-x-5',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-maroon',
            'motion-reduce:transition-none motion-reduce:after:transition-none',
          ].join(' ')}
        />
        <span className="text-base font-medium text-ink-2">{label}</span>
      </label>
      {hint ? <p id={`${id}-hint`} className="mt-2 text-base text-mute">{hint}</p> : null}
    </div>
  );
}
