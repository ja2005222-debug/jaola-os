/** Shared source emitted into standalone Next.js projects; no platform secrets embedded. */
export const FULLSTACK_API_LIB = `import { adminSession, sameOrigin } from './admin-auth';
import { createHash, timingSafeEqual } from 'node:crypto';

export const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (status, code) => Object.assign(new Error(code), { status });
const digest = value => createHash('sha256').update(value).digest();
const matches = (provided, expected) => typeof expected === 'string' && expected.length >= 32 && timingSafeEqual(digest(provided), digest(expected));

// Keys are unique to this deployed project and stay in server environment variables.
export async function authorize(request, { publicRead = false, write = false } = {}) {
  if (publicRead && !write) return null;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') && header.length <= 512 ? header.slice(7) : '';
  const admin = matches(token, process.env.JAOLA_ADMIN_TOKEN);
  const reader = matches(token, process.env.JAOLA_READER_TOKEN);
  if (!admin && !reader) {
    try {
      if (!await adminSession(request)) return reply({ error: 'AUTH_REQUIRED' }, 401);
      if (write && !sameOrigin(request)) return reply({ error: 'ORIGIN_REJECTED' }, 403);
      return null;
    } catch { return reply({ error: 'AUTH_UNAVAILABLE' }, 503); }
  }
  if (write && !admin) return reply({ error: 'WRITE_FORBIDDEN' }, 403);
  return null;
}

export function recordId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw failure(400, 'INVALID_ID');
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2147483647) throw failure(400, 'INVALID_ID');
  return id;
}

export async function readData(request, fields, partial = false) {
  if (!(request.headers.get('content-type') || '').toLowerCase().split(';')[0].trim().match(/^application\\/json$/)) throw failure(415, 'JSON_REQUIRED');
  if (!request.body) throw failure(400, 'EMPTY_BODY');
  const reader = request.body.getReader();
  let text = '', size = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw failure(413, 'BODY_LIMIT'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) { throw error.status ? error : failure(400, 'INVALID_BODY'); }
  finally { reader.releaseLock(); }
  let data;
  try { data = JSON.parse(text); } catch { throw failure(400, 'INVALID_JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) throw failure(400, 'INVALID_DATA');
  const allowed = new Map(fields.map(field => [field.name, field]));
  for (const [key, value] of Object.entries(data)) {
    const field = allowed.get(key);
    if (!field) throw failure(400, 'UNKNOWN_FIELD');
    if (field.type === 'String' && (typeof value !== 'string' || value.length > 10000)) throw failure(400, 'INVALID_STRING');
    if (field.type === 'Int' && (!Number.isInteger(value) || value < 0 || value > 2147483647)) throw failure(400, 'INVALID_INTEGER');
    if (field.type === 'Float' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12)) throw failure(400, 'INVALID_NUMBER');
    if (field.type === 'Boolean' && typeof value !== 'boolean') throw failure(400, 'INVALID_BOOLEAN');
    if (field.type === 'DateTime' && (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z'))) throw failure(400, 'INVALID_DATE');
  }
  if (!partial) for (const field of fields) {
    if (!field.defaulted && !Object.hasOwn(data, field.name)) throw failure(400, 'MISSING_FIELD');
  }
  return data;
}

export function apiError(error) {
  if (error.status) return reply({ error: error.message }, error.status);
  if (error.code === 'P2025') return reply({ error: 'NOT_FOUND' }, 404);
  if (error.code === 'P2002') return reply({ error: 'CONFLICT' }, 409);
  return reply({ error: 'DATA_UNAVAILABLE' }, 503);
}
`;
