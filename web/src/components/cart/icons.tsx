type IconProps = { className?: string };

const svg = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export const BagIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...svg} className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...svg} width={16} height={16} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = ({ className }: IconProps) => (
  <svg {...svg} width={16} height={16} className={className}>
    <path d="M5 12h14" />
  </svg>
);
