import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { products, stores, priceFor } from '../../catalog';
const db = () => { if (!env.DB)
    throw new Error('Database is unavailable. Run npm run setup first.'); return env.DB; };
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), n => n.toString(16).padStart(2, '0')).join('');
async function hash(s: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function password(p: string, salt = crypto.randomUUID()) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']); return salt + ':' + hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256)); }
let seeded: Promise<void> | undefined;
function seed() { return seeded ??= (async () => { const d = db(); for (const u of [{ id: 'demo-alex', name: 'Alex Morgan', email: 'alex@gather.test', role: 'customer', store: null }, { id: 'demo-jamie', name: 'Jamie Lee', email: 'jamie@gather.test', role: 'customer', store: null }, { id: 'demo-staff', name: 'Sam at Meijer', email: 'staff@gather.test', role: 'employee', store: 'meijer' }]) {
    const exists = await d.prepare('SELECT id FROM users WHERE id=?').bind(u.id).first();
    if (!exists)
        await d.prepare('INSERT OR IGNORE INTO users (id,name,email,password,role,store,address) VALUES (?,?,?,?,?,?,?)').bind(u.id, u.name, u.email, await password('Gather123!'), u.role, u.store, 'Indianapolis, IN').run();
} })().catch(e => { seeded = undefined; throw e; }); }
async function current() { const c = (await cookies()).get('gather_session')?.value; if (!c)
    return null; return db().prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires>?').bind(await hash(c), Date.now()).first<any>(); }
function check(ok: any, message: string, status = 400): asserts ok { if (!ok)
    throw Object.assign(new Error(message), { status }); }
async function rows(sql: string, ...values: any[]) { return (await db().prepare(sql).bind(...values).all<any>()).results; }
const safeUser = (u: any) => u ? { id: u.id, email: u.email, name: u.name, phone: u.phone, address: u.address, payment: u.payment, role: u.role, store: u.store } : null;
async function allowed(cartId: string, user: any) { const c = await db().prepare('SELECT * FROM carts WHERE id=?').bind(cartId).first<any>(); check(c, 'Cart not found', 404); check(c.owner === user.id || await db().prepare('SELECT user FROM members WHERE cart=? AND user=?').bind(c.id, user.id).first(), 'You do not have access to this cart', 403); return c; }
async function snapshot(user: any) { const edits = await rows('SELECT * FROM store_edits'); const catalog = stores.map(s => ({ ...s, ...edits.find(e => e.id === s.id) })); const reviews = await rows('SELECT r.*,u.name FROM reviews r JOIN users u ON u.id=r.owner ORDER BY r.created DESC'); const cs = user ? await rows("SELECT DISTINCT c.*,u.name AS owner_name FROM carts c JOIN users u ON u.id=c.owner LEFT JOIN members m ON m.cart=c.id WHERE (c.owner=? OR m.user=?) AND c.status='open'", user.id, user.id) : []; const cartData = await Promise.all(cs.map(async (c) => ({ ...c, items: await rows('SELECT product,quantity FROM items WHERE cart=?', c.id), members: await rows('SELECT u.id,u.name FROM members m JOIN users u ON u.id=m.user WHERE m.cart=?', c.id), removedMembers: c.owner === user.id ? await rows('SELECT u.id,u.name FROM removed_members m JOIN users u ON u.id=m.user WHERE m.cart=?', c.id) : [] }))); const os = user ? await rows('SELECT * FROM orders WHERE owner=? ORDER BY created DESC', user.id) : []; const employeeOrders = user?.role === 'employee' ? await rows('SELECT o.*,u.name AS customer FROM orders o JOIN users u ON u.id=o.owner WHERE o.store=? ORDER BY o.created DESC', user.store) : []; return { user: safeUser(user), stores: catalog, stock: await rows('SELECT * FROM stock'), reviews, carts: cartData, orders: os.map(o => ({ ...o, lines: JSON.parse(o.lines) })), employeeOrders: employeeOrders.map(o => ({ ...o, lines: JSON.parse(o.lines) })) }; }
function failure(e: any) { if (!e.status) console.error(e); return Response.json({ error: e.status ? e.message : 'We could not complete this request. Your changes have not been discarded; please retry.' }, { status: e.status || 500 }); }
export async function GET() { try {
    await seed();
    return Response.json(await snapshot(await current()));
}
catch (e) {
    return failure(e);
} }
export async function POST(request: Request) {
    try {
        const origin = request.headers.get('origin');
        check(origin && origin === new URL(request.url).origin, 'Request origin is not allowed', 403);
        await seed();
        const a: any = await request.json();
        check(a && typeof a === 'object' && !Array.isArray(a), 'Invalid request');
        let u = await current();
        const d = db();
        let result: any = {};
        if (a.action === 'signup' || a.action === 'login') {
            const email = String(a.email || '').trim().toLowerCase(), pass = String(a.password || '');
            check(email.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email');
            check(pass.length >= 8 && pass.length <= 128, 'Password must be 8–128 characters');
            if (a.action === 'signup') {
                const name = String(a.name || '').trim();
                check(name.length >= 2 && name.length <= 80, 'Enter your name');
                check(!await d.prepare('SELECT id FROM users WHERE email=?').bind(email).first(), 'An account with this email already exists', 409);
                await d.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').bind(crypto.randomUUID(), email, name, await password(pass)).run();
            }
            u = await d.prepare('SELECT * FROM users WHERE email=?').bind(email).first<any>();
            check(u, 'Email or password is incorrect', 401);
            check(await password(pass, u.password.split(':')[0]) === u.password, 'Email or password is incorrect', 401);
            const token = crypto.randomUUID() + crypto.randomUUID();
            await d.prepare('INSERT INTO sessions(id,user_id,expires) VALUES(?,?,?)').bind(await hash(token), u.id, Date.now() + 604800000).run();
            (await cookies()).set('gather_session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800, secure: new URL(request.url).protocol === 'https:' });
        }
        else if (a.action === 'logout') {
            const token = (await cookies()).get('gather_session')?.value;
            if (token)
                await d.prepare('DELETE FROM sessions WHERE id=?').bind(await hash(token)).run();
            (await cookies()).delete('gather_session');
            u = null;
        }
        else {
            check(u, 'Sign in to continue', 401);
            if (a.action === 'profile') {
                const name = String(a.name || '').trim(), address = String(a.address || '').trim(), phone = String(a.phone || '').trim();
                check(name.length >= 2 && name.length <= 80 && address.length <= 250 && phone.length <= 30, 'Check your profile details');
                check(['test-visa', 'test-mastercard'].includes(a.payment), 'Choose a test payment method');
                await d.prepare('UPDATE users SET name=?,phone=?,address=?,payment=? WHERE id=?').bind(name, phone, address, a.payment, u.id).run();
                u = await current();
            }
            else if (a.action === 'cart') {
                check(stores.some(s => s.id === a.store), 'Unknown store');
                let c = await d.prepare("SELECT * FROM carts WHERE owner=? AND store=? AND status='open' ORDER BY rowid LIMIT 1").bind(u.id, a.store).first<any>();
                if (!c) {
                    c = { id: crypto.randomUUID() };
                    await d.prepare('INSERT INTO carts(id,owner,store) VALUES(?,?,?)').bind(c.id, u.id, a.store).run();
                }
                result = { cartId: c.id };
            }
            else if (a.action === 'join') {
                check(typeof a.share === 'string' && a.share.length <= 80, 'Invalid invitation');
                const c = await d.prepare("SELECT * FROM carts WHERE share=? AND status='open'").bind(a.share).first<any>();
                check(c, 'This shared cart is no longer available', 404);
                if (c.owner !== u.id) {
                    check(!await d.prepare('SELECT 1 FROM removed_members WHERE cart=? AND user=?').bind(c.id, u.id).first(), 'The cart owner removed your access to this cart', 403);
                    const joined = await d.prepare("INSERT OR IGNORE INTO members(cart,user) SELECT ?,? WHERE EXISTS(SELECT 1 FROM carts WHERE id=? AND status='open') AND NOT EXISTS(SELECT 1 FROM removed_members WHERE cart=? AND user=?)").bind(c.id, u.id, c.id, c.id, u.id).run();
                    check(joined.meta.changes || await d.prepare('SELECT 1 FROM members WHERE cart=? AND user=?').bind(c.id, u.id).first(), 'This invitation is no longer available to you', 403);
                }
                result = { cartId: c.id };
            }
            else if (['item', 'share', 'checkout', 'removeMember', 'restoreMember'].includes(a.action)) {
                const c = await allowed(a.cart, u);
                check(c.status === 'open', 'This cart has already been checked out', 409);
                if (a.action === 'removeMember' || a.action === 'restoreMember') {
                    check(c.owner === u.id, 'Only the cart owner can manage members', 403);
                    check(typeof a.member === 'string' && a.member.length > 0 && a.member.length <= 100, 'Choose a valid member');
                    check(a.member !== u.id, 'The cart owner cannot be removed');
                    if (a.action === 'removeMember') {
                        check(await d.prepare('SELECT 1 FROM members WHERE cart=? AND user=?').bind(c.id, a.member).first(), 'This person is not a member of the cart', 404);
                        await d.batch([
                            d.prepare('INSERT OR IGNORE INTO removed_members(cart,user) VALUES(?,?)').bind(c.id, a.member),
                            d.prepare('DELETE FROM members WHERE cart=? AND user=?').bind(c.id, a.member),
                            d.prepare("UPDATE carts SET revision=revision+1 WHERE id=? AND status='open'").bind(c.id)
                        ]);
                    } else {
                        check(await d.prepare('SELECT 1 FROM removed_members WHERE cart=? AND user=?').bind(c.id, a.member).first(), 'This person was not removed from this cart', 404);
                        await d.batch([
                            d.prepare('DELETE FROM removed_members WHERE cart=? AND user=?').bind(c.id, a.member),
                            d.prepare("INSERT OR IGNORE INTO members(cart,user) SELECT ?,? WHERE EXISTS(SELECT 1 FROM carts WHERE id=? AND status='open')").bind(c.id, a.member, c.id),
                            d.prepare("UPDATE carts SET revision=revision+1 WHERE id=? AND status='open'").bind(c.id)
                        ]);
                    }
                }
                else if (a.action === 'item') {
                    const p = products.find(p => p.id === a.product);
                    check(p, 'Product not found');
                    check(a.delta === 1 || a.delta === -1, 'Invalid quantity');
                    const override = await d.prepare('SELECT available FROM stock WHERE store=? AND product=?').bind(c.store, p.id).first<any>();
                    const available = override?.available ?? p.stock;
                    const before = await d.prepare('SELECT quantity FROM items WHERE cart=? AND product=?').bind(c.id, p.id).first<any>();
                    if (a.delta === 1)
                        check((before?.quantity || 0) < available, 'This item is out of stock or at its quantity limit', 409);
                    const operations = [d.prepare("INSERT INTO items(cart,product,quantity) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM carts WHERE id=? AND status='open') ON CONFLICT(cart,product) DO UPDATE SET quantity=MAX(0,quantity+?) WHERE ?=-1 OR quantity+?<=?").bind(c.id, p.id, a.delta === 1 ? 1 : 0, c.id, a.delta, a.delta, a.delta, available), d.prepare("UPDATE carts SET revision=revision+1 WHERE id=? AND status='open'").bind(c.id), d.prepare('DELETE FROM items WHERE cart=? AND quantity=0').bind(c.id)];
                    await d.batch(operations);
                }
                else if (a.action === 'share') {
                    check(c.owner === u.id, 'Only the cart owner can share the cart', 403);
                    const share = c.share || crypto.randomUUID();
                    await d.prepare('UPDATE carts SET share=? WHERE id=?').bind(share, c.id).run();
                    result = { share };
                }
                else {
                    check(c.owner === u.id, 'Only the cart owner can check out', 403);
                    check(['test-visa', 'test-mastercard'].includes(a.payment), 'Choose a payment method');
                    const pickup = Date.parse(a.pickup);
                    check(Number.isFinite(pickup) && pickup > Date.now() + 900000 && pickup < Date.now() + 7 * 86400000, 'Choose a pickup time at least 15 minutes from now and within 7 days');
                    const date = new Date(pickup);
                    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Indiana/Indianapolis', hour: 'numeric', hourCycle: 'h23' }).format(date));
                    const edited = await d.prepare('SELECT hours FROM store_edits WHERE id=?').bind(c.store).first<any>();
                    const hours = edited?.hours || stores.find(s => s.id === c.store)!.hours;
                    const match = hours.match(/^(\d{1,2}):(\d{2}) (AM|PM) [–-] (\d{1,2}):(\d{2}) (AM|PM)$/);
                    const toMinutes = (h: string, m: string, ap: string) => (Number(h) % 12 + (ap === 'PM' ? 12 : 0)) * 60 + Number(m);
                    const limits = match ? [toMinutes(match[1], match[2], match[3]), toMinutes(match[4], match[5], match[6])] : [480, 1320];
                    const localMinute = hour * 60 + Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Indiana/Indianapolis', minute: '2-digit' }).format(date));
                    check(localMinute >= limits[0] && localMinute < limits[1], 'Pickup must be during the sample store hours');
                    const person = String(a.person || u.name).trim();
                    check(person.length >= 2 && person.length <= 80, 'Enter the pickup person’s name');
                    const its = await rows('SELECT product,quantity FROM items WHERE cart=?', c.id);
                    check(its.length, 'Your cart is empty');
                    let subtotal = 0;
                    const lines = [];
                    for (const it of its) {
                        const p = products.find(p => p.id === it.product)!;
                        const ov = await d.prepare('SELECT available FROM stock WHERE store=? AND product=?').bind(c.store, p.id).first<any>();
                        check(it.quantity <= (ov?.available ?? p.stock), 'An item is no longer available. Please update your cart.', 409);
                        const price = priceFor(p.id, c.store);
                        subtotal += price * it.quantity;
                        lines.push({ ...it, name: p.name, price });
                    }
                    const fee = 299, tax = Math.round((subtotal + fee) * .07), id = c.store.toUpperCase().slice(0, 3) + '-' + crypto.randomUUID().slice(0, 8).toUpperCase();
                    const r = await d.batch([d.prepare("INSERT INTO orders(id,cart,owner,store,created,pickup,person,payment,subtotal,fee,tax,lines) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM carts WHERE id=? AND status='open' AND revision=?)").bind(id, c.id, u.id, c.store, Date.now(), new Date(pickup).toISOString(), person, a.payment, subtotal, fee, tax, JSON.stringify(lines), c.id, c.revision), d.prepare("UPDATE carts SET status='closed',share=NULL WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE cart=?)").bind(c.id, c.id), d.prepare("DELETE FROM members WHERE cart=? AND EXISTS(SELECT 1 FROM orders WHERE cart=?)").bind(c.id, c.id)]);
                    check(r[0].meta.changes, 'Your cart changed during checkout. Review it and try again.', 409);
                    result = { orderId: id };
                }
            }
            else if (a.action === 'review') {
                check(Number.isInteger(a.rating) && a.rating >= 1 && a.rating <= 5, 'Choose a rating from 1 to 5');
                const comment = String(a.comment || '').trim();
                check(comment.length >= 3 && comment.length <= 1000, 'Write a review between 3 and 1,000 characters');
                const o = await d.prepare('SELECT * FROM orders WHERE id=? AND owner=?').bind(a.order, u.id).first<any>();
                check(o, 'You can only review a store using your own order number', 403);
                check(!await d.prepare('SELECT id FROM reviews WHERE order_id=?').bind(o.id).first(), 'You already reviewed this order', 409);
                await d.prepare('INSERT INTO reviews(id,order_id,owner,store,rating,comment,created) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), o.id, u.id, o.store, a.rating, comment, Date.now()).run();
            }
            else if (['status', 'storeEdit', 'stock'].includes(a.action)) {
                check(u.role === 'employee', 'Employee access required', 403);
                if (a.action === 'status') {
                    const o = await d.prepare('SELECT * FROM orders WHERE id=? AND store=?').bind(a.order, u.store).first<any>();
                    check(o, 'Order not found for your store', 403);
                    const next: Record<string, string> = { confirmed: 'preparing', preparing: 'ready', ready: 'collected' };
                    check(next[o.status] === a.status, 'Order statuses must advance in sequence');
                    const r = await d.prepare('UPDATE orders SET status=? WHERE id=? AND status=?').bind(a.status, o.id, o.status).run();
                    check(r.meta.changes, 'Order status changed. Please refresh.', 409);
                }
                else if (a.action === 'stock') {
                    check(products.some(p => p.id === a.product) && Number.isInteger(a.available) && a.available >= 0 && a.available <= 999, 'Enter stock from 0 to 999');
                    await d.prepare('INSERT INTO stock(store,product,available) VALUES(?,?,?) ON CONFLICT(store,product) DO UPDATE SET available=excluded.available').bind(u.store, a.product, a.available).run();
                }
                else {
                    for (const k of ['name', 'address', 'hours'])
                        check(typeof a[k] === 'string' && a[k].trim().length > 1 && a[k].length <= 250, 'Complete the store details');
                    const hm = a.hours.match(/^(\d{1,2}):(\d{2}) (AM|PM) [–-] (\d{1,2}):(\d{2}) (AM|PM)$/);
                    check(hm && [hm[1], hm[4]].every(h => Number(h) >= 1 && Number(h) <= 12) && [hm[2], hm[5]].every(m => Number(m) < 60), 'Use hours like 8:00 AM – 10:00 PM');
                    const minutes = (h: string, m: string, ap: string) => (Number(h) % 12 + (ap === 'PM' ? 12 : 0)) * 60 + Number(m);
                    check(minutes(hm[1], hm[2], hm[3]) < minutes(hm[4], hm[5], hm[6]), 'Closing time must be after opening time');
                    await d.prepare('INSERT INTO store_edits(id,name,address,hours) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address,hours=excluded.hours').bind(u.store, a.name.trim(), a.address.trim(), a.hours.trim()).run();
                }
            }
            else
                check(false, 'Unknown action');
        }
        return Response.json({ ...await snapshot(u), ...result });
    }
    catch (e) {
        return failure(e);
    }
}
