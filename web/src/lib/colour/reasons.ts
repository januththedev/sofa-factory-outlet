import type { Family } from './classify';

const nounFor = (path: string) => {
  const parts = path.toLowerCase().split('/');
  if (parts.includes('pillows')) return 'cushions';
  if (parts.includes('ottomans')) return 'ottoman';
  if (parts.includes('tables')) return 'coffee table';
  if (parts.includes('chairs')) return 'armchair';
  if (parts.includes('beds')) return 'bedding';
  if (parts.includes('sofas')) return 'sofa';
  return 'piece';
};

const lower = (value: string) => value.trim().toLocaleLowerCase('en-GB');
const sentenceCase = (value: string) => value ? value[0].toLocaleUpperCase('en-GB') + value.slice(1) : value;

export function describeReason(input: {
  candidateCategoryPath: string;
  candidateColourName: string;
  candidateFamily: Family;
  anchorColourName: string;
  anchorMaterial?: string | null;
  verb: string | null;
}): string {
  const candidate = lower(input.candidateColourName) || input.candidateFamily;
  const anchor = [lower(input.anchorColourName), input.anchorMaterial ? lower(input.anchorMaterial) : ''].filter(Boolean).join(' ');
  const subject = `${candidate} ${nounFor(input.candidateCategoryPath)}`;
  return input.verb
    ? `${sentenceCase(subject)} ${input.verb} ${anchor}`
    : `${sentenceCase(subject)} goes well with ${anchor}`;
}
