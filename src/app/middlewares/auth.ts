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
  if (!header.startsWith('Bearer ')) return error(res, 'Unauthorized', 401);
  const token = header.slice(7).trim();
  if (!token) return error(res, 'Unauthorized', 401);

  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET as string);
  } catch {
    return error(res, 'Invalid token', 401);
  }

  req.user = payload;
  if (payload.role === 'admin') return next();
  const q = String(req.query?.q ?? '').trim();
  const userId = String(payload.jmbg ?? '').trim();
  const target = q || req.params?.jmbg || req.body?.jmbg || null;
  if (!target) return error(res, 'Unauthorized', 401);
  if (userId === target) return next();
  return error(res, 'Forbidden', 403);
};

export default authenticate;
