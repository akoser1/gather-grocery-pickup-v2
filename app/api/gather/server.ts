import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { stores } from '../../catalog';
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
const safeUser = (u: any) => u ? { id: u.id, email: u.email, name: u.name, phone: u.phone, address: u.address, payment: u.payment, role: u.role, store: u.store } : null;
export async function allowed(cartId: string, user: any) { const c = await db().prepare('SELECT * FROM carts WHERE id=?').bind(cartId).first<any>(); check(c, 'Cart not found', 404); check(c.owner === user.id || await db().prepare('SELECT user FROM members WHERE cart=? AND user=?').bind(c.id, user.id).first(), 'You do not have access to this cart', 403); return c; }
export async function snapshot(user: any) { const edits = await rows('SELECT * FROM store_edits'); const catalog = stores.map(s => ({ ...s, ...edits.find(e => e.id === s.id) })); const reviews = await rows('SELECT r.*,u.name FROM reviews r JOIN users u ON u.id=r.owner ORDER BY r.created DESC'); const cs = user ? await rows("SELECT DISTINCT c.*,u.name AS owner_name FROM carts c JOIN users u ON u.id=c.owner LEFT JOIN members m ON m.cart=c.id WHERE (c.owner=? OR m.user=?) AND c.status='open'", user.id, user.id) : []; const cartData = await Promise.all(cs.map(async (c) => ({ ...c, items: await rows('SELECT product,quantity FROM items WHERE cart=?', c.id), members: await rows('SELECT u.id,u.name FROM members m JOIN users u ON u.id=m.user WHERE m.cart=?', c.id), removedMembers: c.owner === user.id ? await rows('SELECT u.id,u.name FROM removed_members m JOIN users u ON u.id=m.user WHERE m.cart=?', c.id) : [] }))); const os = user ? await rows('SELECT * FROM orders WHERE owner=? ORDER BY created DESC', user.id) : []; const employeeOrders = user?.role === 'employee' ? await rows('SELECT o.*,u.name AS customer FROM orders o JOIN users u ON u.id=o.owner WHERE o.store=? ORDER BY o.created DESC', user.store) : []; return { user: safeUser(user), stores: catalog, stock: await rows('SELECT * FROM stock'), reviews, carts: cartData, orders: os.map(o => ({ ...o, lines: JSON.parse(o.lines) })), employeeOrders: employeeOrders.map(o => ({ ...o, lines: JSON.parse(o.lines) })) }; }
export function failure(e: any) { if (!e.status) console.error(e); return Response.json({ error: e.status ? e.message : 'We could not complete this request. Your changes have not been discarded; please retry.' }, { status: e.status || 500 }); }
