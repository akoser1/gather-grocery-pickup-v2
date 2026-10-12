import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
export const db = () => { if (!env.DB)
    throw new Error('Database is unavailable. Run npm run setup first.'); return env.DB; };
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), n => n.toString(16).padStart(2, '0')).join('');
export async function hash(s: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
export async function password(p: string, salt = crypto.randomUUID()) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']); return salt + ':' + hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256)); }
let seeded: Promise<void> | undefined;
export function seed() { return seeded ??= (async () => { const d = db(); for (const u of [{ id: 'demo-alex', name: 'Alex Morgan', email: 'alex@gather.test', role: 'customer', store: null }, { id: 'demo-jamie', name: 'Jamie Lee', email: 'jamie@gather.test', role: 'customer', store: null }, { id: 'demo-staff', name: 'Sam at Meijer', email: 'staff@gather.test', role: 'employee', store: 'meijer' }]) {
    const exists = await d.prepare('SELECT id FROM users WHERE id=?').bind(u.id).first();
    if (!exists)
        await d.prepare('INSERT OR IGNORE INTO users (id,name,email,password,role,store,address) VALUES (?,?,?,?,?,?,?)').bind(u.id, u.name, u.email, await password('Gather123!'), u.role, u.store, 'Indianapolis, IN').run();
} })().catch(e => { seeded = undefined; throw e; }); }
export async function current() { const c = (await cookies()).get('gather_session')?.value; if (!c)
    return null; return db().prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires>?').bind(await hash(c), Date.now()).first<any>(); }
export function check(ok: any, message: string, status = 400): asserts ok { if (!ok)
    throw Object.assign(new Error(message), { status }); }
export async function rows(sql: string, ...values: any[]) { return (await db().prepare(sql).bind(...values).all<any>()).results; }
export async function allowed(cartId: string, user: any) { const c = await db().prepare('SELECT * FROM carts WHERE id=?').bind(cartId).first<any>(); check(c, 'Cart not found', 404); check(c.owner === user.id || await db().prepare('SELECT user FROM members WHERE cart=? AND user=?').bind(c.id, user.id).first(), 'You do not have access to this cart', 403); return c; }
export function failure(e: any) { if (!e.status) console.error(e); return Response.json({ error: e.status ? e.message : 'We could not complete this request. Your changes have not been discarded; please retry.' }, { status: e.status || 500 }); }
