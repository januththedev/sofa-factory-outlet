import { describe, expect, it } from 'vitest';
import {
  formatLkPhone,
  isLkMobile,
  normaliseLkPhone,
  whatsappDigitsFor,
} from '@/lib/phone';

describe('normaliseLkPhone', () => {
  it.each([
    ['0771234567', '+94771234567'],
    ['+94771234567', '+94771234567'],
    ['0094771234567', '+94771234567'],
    ['94771234567', '+94771234567'],
    ['077 123 4567', '+94771234567'],
    ['077-123-4567', '+94771234567'],
    ['0112345678', '+94112345678'],
    ['+94 11 234 5678', '+94112345678'],
    ['0094-11-234-5678', '+94112345678'],
    ['94 11 234 5678', '+94112345678'],
    ['011 234-5678', '+94112345678'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normaliseLkPhone(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['077123456', 'too short'],
    ['07712345678', 'too long'],
    ['077ABC1234567', 'letters'],
  ])('rejects %s (%s)', (input) => {
    expect(normaliseLkPhone(input)).toBeNull();
  });
});

describe('isLkMobile', () => {
  it('accepts a normalised mobile number', () => {
    expect(isLkMobile('+94771234567')).toBe(true);
  });

  it.each(['+94112345678', '0771234567', '+9477123456', '+947712345678'])(
    'rejects a landline or malformed number: %s',
    (phone) => {
      expect(isLkMobile(phone)).toBe(false);
    },
  );
});

describe('formatLkPhone', () => {
  it.each([
    ['+94771234567', '+94 77 123 4567'],
    ['+94112345678', '+94 11 234 5678'],
  ])('formats %s as %s', (phone, expected) => {
    expect(formatLkPhone(phone)).toBe(expected);
  });

  it('returns invalid input unchanged', () => {
    expect(formatLkPhone('0771234567')).toBe('0771234567');
  });
});

describe('whatsappDigitsFor', () => {
  it.each([
    ['+94771234567', '94771234567'],
    ['+94 77 123-4567', '94771234567'],
    ['+94112345678', '94112345678'],
  ])('returns only digits from %s', (phone, expected) => {
    expect(whatsappDigitsFor(phone)).toBe(expected);
  });
});
