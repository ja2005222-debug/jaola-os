import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDB } from './database.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'jaola_secret_key_change_me';

export async function registerUser(username, password) {
  const db = getDB();
  const hashed = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  const stmt = db.prepare(`INSERT INTO users (id, username, password, createdAt) VALUES (?, ?, ?, ?)`);
  stmt.run(id, username, hashed, new Date().toISOString());
  return { id, username };
}

export async function loginUser(username, password) {
  const db = getDB();
  const stmt = db.prepare(`SELECT * FROM users WHERE username = ?`);
  const user = stmt.get(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, username: user.username } };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}
