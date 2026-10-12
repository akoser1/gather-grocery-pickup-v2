import { db, check } from '../server';

/** Review eligibility and persistence; keeps the original API semantics. */
export async function submitReview(a: any, u: any, d: ReturnType<typeof db>) {
    check(Number.isInteger(a.rating) && a.rating >= 1 && a.rating <= 5, 'Choose a rating from 1 to 5');
                const comment = String(a.comment || '').trim();
                check(comment.length >= 3 && comment.length <= 1000, 'Write a review between 3 and 1,000 characters');
                const o = await d.prepare('SELECT * FROM orders WHERE id=? AND owner=?').bind(a.order, u.id).first<any>();
                check(o, 'You can only review a store using your own order number', 403);
                check(!await d.prepare('SELECT id FROM reviews WHERE order_id=?').bind(o.id).first(), 'You already reviewed this order', 409);
                await d.prepare('INSERT INTO reviews(id,order_id,owner,store,rating,comment,created) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), o.id, u.id, o.store, a.rating, comment, Date.now()).run();
}
