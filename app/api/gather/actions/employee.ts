import { products } from '../../../catalog';
import { db, check } from '../server';

/** Employee-only order, stock, and store-management actions. */
export async function manageStore(a: any, u: any, d: ReturnType<typeof db>) {
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
