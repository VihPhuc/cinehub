import { envValidationSchema } from './env.validation';

describe('environment validation', () => {
  it('rejects a plain HTTP upstream in production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      PHIMAPI_BASE_URL: 'http://phimapi.com',
    });

    expect(error).toBeDefined();
  });

  it('accepts an HTTPS upstream in production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      PHIMAPI_BASE_URL: 'https://phimapi.com',
    });

    expect(error).toBeUndefined();
  });

  it('validates catalog index settings', () => {
    const base = { NODE_ENV: 'test' };
    expect(
      envValidationSchema.validate({ ...base, CATALOG_INDEX_CONCURRENCY: '8' }).error
    ).toBeUndefined();
    expect(
      envValidationSchema.validate({ ...base, CATALOG_INDEX_CONCURRENCY: '0' }).error
    ).toBeDefined();
    expect(
      envValidationSchema.validate({ ...base, CATALOG_INDEX_CONCURRENCY: '33' }).error
    ).toBeDefined();
  });

  it('still accepts a local HTTP stub outside production', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'test',
      PHIMAPI_BASE_URL: 'http://127.0.0.1:4567',
    });

    expect(error).toBeUndefined();
  });
});
