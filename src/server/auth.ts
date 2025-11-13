import type { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { appConfig } from './config.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    subject: string;
    roles: string[];
    scopes: string[];
    raw: JwtPayload;
  };
}

function extractToken(headerValue?: string): string | null {
  if (!headerValue) {
    return null;
  }
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!appConfig.AUTH_JWT_SECRET) {
    res.status(500).json({ error: 'AUTH_JWT_SECRET is not configured' });
    return;
  }

  const token = extractToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, appConfig.AUTH_JWT_SECRET, {
      algorithms: ['HS256']
    }) as JwtPayload;

    const rolesClaim = decoded['roles'];
    const scopeClaim = decoded['scp'] ?? decoded['scope'];

    req.user = {
      subject: decoded.sub ?? 'unknown',
      roles: Array.isArray(rolesClaim)
        ? (rolesClaim as string[])
        : typeof rolesClaim === 'string'
        ? rolesClaim.split(' ')
        : [],
      scopes: typeof scopeClaim === 'string' ? scopeClaim.split(' ') : [],
      raw: decoded
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid bearer token', details: (error as Error).message });
  }
}

