import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function makeContext(headerValue: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { 'x-api-key': headerValue },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  const VALID_KEY = 'test-api-key-12345';

  beforeEach(() => {
    process.env.API_KEY = VALID_KEY;
    guard = new ApiKeyGuard();
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('should return true when valid API key is provided', () => {
    const ctx = makeContext(VALID_KEY);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException when API key header is absent', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when API key has wrong length', () => {
    const ctx = makeContext('short');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when API key has correct length but wrong content', () => {
    const sameLength = 'X'.repeat(VALID_KEY.length);
    const ctx = makeContext(sameLength);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
