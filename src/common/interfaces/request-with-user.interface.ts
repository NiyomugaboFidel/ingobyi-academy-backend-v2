import { Request } from 'express';
import { ApiKeyScope, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  /** Platform role (SUPERADMIN or base member role). */
  role: UserRole;
  orgId?: string;
  /** Active membership role in the current workspace. */
  orgRole?: UserRole;
  /** Refresh token version for revocation checks. */
  rv?: number;
}

export interface AuthenticatedUser extends JwtPayload {
  userId: string;
}

export interface ApiKeyContext {
  apiKeyId: string;
  userId: string;
  orgId?: string;
  scopes: ApiKeyScope[];
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  apiKey?: ApiKeyContext;
}
