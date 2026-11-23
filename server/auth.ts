import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole, AdminUser } from '../shared/types.ts';
import { db } from './db.ts';

export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, string[]> = {
  owner: ['products', 'orders', 'consultations', 'reviews', 'settings', 'staff'],
  manager: ['products', 'orders', 'consultations', 'reviews', 'settings'],
  staff: ['orders', 'consultations', 'reviews'],
};

export interface AuthedAdminRequest extends Request {
  adminUser?: AdminUser;
  sessionTokenHash?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function constantTimeStringCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAdminSession(adminUserId: number): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(new Date().toISOString());
  db.prepare(
    'INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at) VALUES (?, ?, ?)'
  ).run(tokenHash, adminUserId, expiresAt);
  return { token, expiresAt };
}

export function getAdminAuthStatus(): {
  needsSetup: boolean;
  envPasscodeConfigured: boolean;
  defaultAdminEmail: string;
} {
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;
  return {
    needsSetup: envPasscode.length === 0 && count === 0,
    envPasscodeConfigured: envPasscode.length > 0,
    defaultAdminEmail: (process.env.ADMIN_EMAIL || 'admin@hoanelly.vn').trim().toLowerCase(),
  };
}

export function ensureEnvOwnerExists(): AdminUser {
  const email = (process.env.ADMIN_EMAIL || 'admin@hoanelly.vn').trim().toLowerCase();
  const existing = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email) as
    | Record<string, unknown>
    | undefined;
  if (existing) {
    return mapAdminRow(existing);
  }
  const placeholderHash = hashPassword(crypto.randomBytes(24).toString('hex'));
  const info = db
    .prepare(
      `INSERT INTO admin_users (email, full_name, password_hash, role, permissions_json, is_active)
       VALUES (?, ?, ?, 'owner', ?, 1)`
    )
    .run(email, 'Chủ cửa hàng Hoa Nelly', placeholderHash, JSON.stringify(ROLE_DEFAULT_PERMISSIONS.owner));
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(info.lastInsertRowid) as Record<
    string,
    unknown
  >;
  return mapAdminRow(row);
}

export function mapAdminRow(row: Record<string, unknown>): AdminUser {
  let perms: string[] = [];
  try {
    perms = JSON.parse(String(row.permissions_json || '[]'));
  } catch {
    perms = [];
  }
  return {
    id: Number(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    role: row.role as AdminRole,
    permissions: perms,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

export function requireAdmin(requiredPermission?: string) {
  return (req: AuthedAdminRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Vui lòng đăng nhập quản trị để thực hiện thao tác này.' });
      return;
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
      return;
    }
    const tokenHash = hashToken(token);
    const session = db
      .prepare(
        `SELECT s.token_hash, s.expires_at, u.*
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.admin_user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as Record<string, unknown> | undefined;

    if (!session) {
      res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không tồn tại.' });
      return;
    }
    if (new Date(String(session.expires_at)).getTime() < Date.now()) {
      db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
      res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
      return;
    }
    if (!session.is_active) {
      res.status(403).json({ error: 'Tài khoản quản trị này đang bị tạm khóa.' });
      return;
    }

    const user = mapAdminRow(session);
    if (requiredPermission && user.role !== 'owner' && !user.permissions.includes(requiredPermission)) {
      res.status(403).json({ error: 'Tài khoản của bạn chưa được cấp quyền truy cập chức năng này.' });
      return;
    }

    req.adminUser = user;
    req.sessionTokenHash = tokenHash;
    next();
  };
}

// Simple in-memory sliding-window rate limiter
const rateStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(keyPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const record = rateStore.get(key);
    if (!record || record.resetAt < now) {
      rateStore.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (record.count >= maxRequests) {
      res.status(429).json({
        error: 'Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một lát rồi thử lại.',
      });
      return;
    }
    record.count += 1;
    next();
  };
}
