import { describe, expect, it } from 'vitest';
import {
  collectVerifiedFactors,
  maskPhone,
  normalizeFactorType,
  smsErrorKey,
  validateE164,
} from '@/lib/mfaFactors';

describe('validateE164', () => {
  it('accepts a Swiss mobile number with formatting', () => {
    const r = validateE164('+41 79 123 45 67');
    expect(r.valid).toBe(true);
    expect(r.value).toBe('+41791234567');
  });

  it('rejects a number without a country code', () => {
    expect(validateE164('0791234567')).toMatchObject({ valid: false, error: 'missing_plus' });
  });

  it('rejects a leading zero after the country code', () => {
    expect(validateE164('+0791234567')).toMatchObject({ valid: false, error: 'leading_zero' });
  });

  it('rejects too short and too long numbers', () => {
    expect(validateE164('+4179')).toMatchObject({ valid: false, error: 'too_short' });
    expect(validateE164('+41791234567890123')).toMatchObject({ valid: false, error: 'too_long' });
  });

  it('rejects letters', () => {
    expect(validateE164('+41ABCDEFGH').valid).toBe(false);
  });
});

describe('collectVerifiedFactors', () => {
  it('keeps only verified factors, dedupes and maps types', () => {
    const factors = collectVerifiedFactors({
      totp: [{ id: 'a', status: 'verified', factor_type: 'totp', friendly_name: 'App' }],
      phone: [{ id: 'b', status: 'verified', factor_type: 'phone', phone: '+41791234567' }],
      all: [
        { id: 'a', status: 'verified', factor_type: 'totp' },
        { id: 'c', status: 'unverified', factor_type: 'phone' },
      ],
    });
    expect(factors.map((f) => f.id)).toEqual(['a', 'b']);
    expect(factors[1]).toMatchObject({ factorType: 'phone', phone: '+41791234567' });
  });
});

describe('smsErrorKey', () => {
  it('maps provider failures to specific keys', () => {
    expect(smsErrorKey({ message: 'over_sms_send_rate_limit' })).toBe('rateLimit');
    expect(smsErrorKey({ message: 'Insufficient balance on account' })).toBe('balance');
    expect(smsErrorKey({ message: 'Trial accounts can only send to whitelisted numbers' })).toBe(
      'unsupportedCountry',
    );
    expect(smsErrorKey({ message: 'Invalid phone number' })).toBe('invalidNumber');
    expect(smsErrorKey({ message: 'something odd' })).toBe('provider');
  });
});

describe('helpers', () => {
  it('normalises unknown factor types to totp', () => {
    expect(normalizeFactorType('phone')).toBe('phone');
    expect(normalizeFactorType(undefined)).toBe('totp');
  });

  it('masks phone numbers', () => {
    expect(maskPhone('+41791234567')).toBe('+41 ••• ••• 67');
    expect(maskPhone(null)).toBe('');
  });
});
