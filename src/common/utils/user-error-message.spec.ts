import { HttpStatus } from '@nestjs/common';
import {
  defaultMessageForStatus,
  isTechnicalMessage,
  toUserErrorMessage,
} from './user-error-message';

describe('user-error-message', () => {
  it('maps known auth messages', () => {
    expect(
      toUserErrorMessage('Invalid credentials', HttpStatus.UNAUTHORIZED, true),
    ).toBe('Email or password is incorrect.');
  });

  it('hides technical errors in production', () => {
    expect(
      toUserErrorMessage(
        'PrismaClientKnownRequestError: P2002',
        HttpStatus.INTERNAL_SERVER_ERROR,
        true,
      ),
    ).toBe(defaultMessageForStatus(HttpStatus.INTERNAL_SERVER_ERROR));
  });

  it('keeps safe messages in development', () => {
    expect(
      toUserErrorMessage('Course not found', HttpStatus.NOT_FOUND, false),
    ).toBe('This course is no longer available.');
  });

  it('detects technical patterns', () => {
    expect(isTechnicalMessage('Cannot read property "id" of undefined')).toBe(
      true,
    );
    expect(isTechnicalMessage('Course not found')).toBe(false);
  });
});
