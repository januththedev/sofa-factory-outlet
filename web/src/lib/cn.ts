import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names, resolving Tailwind conflicts (later wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
