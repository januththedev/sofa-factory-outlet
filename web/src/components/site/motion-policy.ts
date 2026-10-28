/** Phones, touch pointers and reduced motion all use immediate navigation. */
export function skipCurtain(reduced: boolean, coarse: boolean, width: number): boolean {
  return reduced || coarse || width < 768;
}
