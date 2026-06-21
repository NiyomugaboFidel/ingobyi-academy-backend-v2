import { HttpStatus } from '@nestjs/common';

const STATUS_FALLBACKS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]:
    'Something in your request looks incorrect. Please check and try again.',
  [HttpStatus.UNAUTHORIZED]: 'Please sign in to continue.',
  [HttpStatus.FORBIDDEN]: 'You do not have permission to do that.',
  [HttpStatus.NOT_FOUND]: 'We could not find what you were looking for.',
  [HttpStatus.CONFLICT]: 'This action conflicts with existing information.',
  [HttpStatus.UNPROCESSABLE_ENTITY]:
    'Some details are invalid. Please review the form and try again.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Too many attempts. Please wait a moment and try again.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Something went wrong on our side. Please try again in a moment.',
  [HttpStatus.BAD_GATEWAY]:
    'The service is temporarily unavailable. Please try again.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'The service is temporarily unavailable. Please try again.',
};

/** Known API messages mapped to clearer user-facing copy. */
const MESSAGE_ALIASES: Record<string, string> = {
  'Invalid credentials': 'Email or password is incorrect.',
  'Email not verified. OTP resent.':
    'Please verify your email. We sent you a new verification code.',
  'Invalid refresh token': 'Your session has ended. Please sign in again.',
  'No refresh token': 'Your session has ended. Please sign in again.',
  'Token revoked': 'Your session has ended. Please sign in again.',
  'User inactive':
    'This account is inactive. Contact support if you need help.',
  'Access denied': 'You do not have permission to access this area.',
  'Insufficient role permissions':
    'You do not have permission to perform this action.',
  'Record not found': 'We could not find what you were looking for.',
  'A record with this value already exists':
    'This information is already in use. Try a different value.',
  'Not enrolled': 'You need to enroll in this course first.',
  'Enrollment required': 'You need to enroll in this course first.',
  'Course not found': 'This course is no longer available.',
  'Lesson not found': 'This lesson is no longer available.',
  'Quiz not found': 'This quiz is no longer available.',
  'Answer every question': 'Please answer every question before submitting.',
  'Invalid quiz content': 'This quiz is not ready yet. Please try again later.',
  'Too many OTP requests':
    'Too many verification codes requested. Please wait before trying again.',
  'Email already registered': 'An account with this email already exists.',
};

const TECHNICAL_PATTERNS: RegExp[] = [
  /prisma/i,
  /sql/i,
  /ECONNREFUSED/i,
  /EADDR/i,
  /socket/i,
  /stack trace/i,
  /unexpected token/i,
  /cannot read propert/i,
  /internal server error/i,
  /jwt/i,
  /invalid `/i,
  /^Error:/i,
  /nestjs/i,
  /node_modules/i,
  /P\d{4}/,
];

export function defaultMessageForStatus(statusCode: number): string {
  return (
    STATUS_FALLBACKS[statusCode] ??
    STATUS_FALLBACKS[HttpStatus.INTERNAL_SERVER_ERROR]
  );
}

export function isTechnicalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length > 220) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function normalizeValidationMessage(message: string): string {
  return message
    .replace(/\bmust be an?\b/gi, 'should be a')
    .replace(/\bshould not exist\b/gi, 'is not allowed')
    .replace(/\bmust not be empty\b/gi, 'is required')
    .replace(/\bproperty\b/gi, 'field');
}

export function toUserErrorMessage(
  rawMessage: string | string[] | undefined,
  statusCode: number,
  isProduction: boolean,
): string {
  const joined = Array.isArray(rawMessage)
    ? rawMessage
        .map((part) => normalizeValidationMessage(String(part)))
        .join(' ')
    : rawMessage
      ? normalizeValidationMessage(String(rawMessage))
      : '';

  const trimmed = joined.trim();
  if (MESSAGE_ALIASES[trimmed]) return MESSAGE_ALIASES[trimmed];

  if (!trimmed) return defaultMessageForStatus(statusCode);

  if (isProduction && isTechnicalMessage(trimmed)) {
    return defaultMessageForStatus(statusCode);
  }

  return trimmed;
}
