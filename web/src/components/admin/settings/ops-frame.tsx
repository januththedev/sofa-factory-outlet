export function OpsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={
      'min-w-0 max-w-full text-base [overflow-wrap:anywhere] '
      + '[&_fieldset]:min-w-0 [&_label]:min-w-0 [&_input]:min-w-0 [&_select]:max-w-full '
      + '[&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center [&_a]:inline-flex '
      + '[&_summary]:min-h-11 [&_summary]:cursor-pointer '
      + '[&_input[type=checkbox]]:size-11 [&_input[type=radio]]:size-11 '
      + '[&_input]:text-base [&_select]:text-base [&_textarea]:text-base '
      + '[&_input]:scroll-mt-24 [&_input]:scroll-mb-36 [&_textarea]:scroll-mb-36 '
      + '[&_table]:text-base sm:[&_table]:text-sm print:contents'
    }>
      {children}
    </div>
  );
}
