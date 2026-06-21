import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { toUserErrorMessage } from '../utils/user-error-message';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let rawMessage: string | string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        rawMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const body = exceptionResponse as Record<string, unknown>;
        rawMessage = body.message as string | string[] | undefined;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        rawMessage = 'A record with this value already exists';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        rawMessage = 'Record not found';
      } else {
        this.logger.error(
          `Prisma ${exception.code}: ${exception.message}`,
          exception.stack,
        );
        rawMessage = undefined;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `${request.method} ${request.url} — ${exception.message}`,
        exception.stack,
      );
      rawMessage = isProduction ? undefined : exception.message;
    } else {
      this.logger.error(
        `Unknown exception on ${request.method} ${request.url}`,
      );
    }

    const message = toUserErrorMessage(rawMessage, statusCode, isProduction);

    response.status(statusCode).json({
      success: false,
      message,
      statusCode,
    });
  }
}
