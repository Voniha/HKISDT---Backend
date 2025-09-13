import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { success, error } from '../utils/responses';

const JWT_SECRET = process.env.JWT_SECRET;
export type Role = 'admin' | 'user';

export const authenticate: RequestHandler = (req: any, res: any, next: any) => {
  const header = String(req.headers?.authorization ?? '');
  if (!header.startsWith('Bearer ')) return error(res, 'Unauthorized', 401);
  const token = header.slice(7).trim();
  if (!token) return error(res, 'Unauthorized', 401);
  try {
    const payload = jwt.verify(token, JWT_SECRET as string);
    req.user = payload;
    return next();
  } catch (err) {
    console.error(err);
    return error(res, 'Invalid token', 401);
  }
};

export const authorize = (...roles: Role[]): RequestHandler => {
  return (req: any, res: any, next: any) => {
    const role = req.user?.role as Role | undefined;
    if (!role) return error(res, 'Unauthorized', 401);
    if (roles.length && !roles.includes(role)) return error(res, 'Forbidden', 403);
    return next();
  };
};

export const matchQueryToUser: RequestHandler = (req: any, res: any, next: any) => {
  const header = String(req.headers?.authorization ?? '');
  let payload: any = null;

  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      try {
        payload = jwt.verify(token, JWT_SECRET as string);
      } catch (err) {
        console.error(err);
        payload = null;
      }
    }
  }

  req.user = payload;

  const q = String(req.query?.q ?? '').trim();
  if (q) {
    if (!payload) return error(res, 'Unauthorized', 401);
    const userId = String(payload.id ?? payload.userId ?? '');
    if (userId !== q && payload.role !== 'admin') return error(res, 'Forbidden', 403);
  }

  return next();
};

export default authenticate;
