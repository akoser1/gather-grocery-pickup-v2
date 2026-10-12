'use client';
import { Users } from 'lucide-react';

type Props = {
    data: any; user: any; busy: boolean;
    act: (payload: any) => Promise<any>;
    onShop: () => void;
    onSelectStore: (store: string) => void;
    onSelectCart: (cart: string) => void;
    onNotice: (message: string) => void;
    onRemoveMember: (cart: string, member: string, name: string) => Promise<void>;
    onRestoreMember: (cart: string, member: string, name: string) => Promise<void>;
};

/** Shared cart list, membership management and invitation joining. */
export default function SharedCartsPage({data,user,busy,act,onShop,onSelectStore,onSelectCart,onNotice,onRemoveMember,onRestoreMember}: Props) {
    return (<><span className="page-eyebrow">BETTER TOGETHER</span><h1>Shared carts</h1><p className="intro">Everyone can add. The cart owner handles checkout.</p>{data.carts.filter(c => c.share || c.owner !== user?.id).length === 0 ? <div className="empty-box"><Users /><h3>The household grocery list, upgraded.</h3><p>Add an item to your cart, then use “Share cart” to invite someone.</p><button className="primary" onClick={() => onShop()}>Start a cart</button></div> : data.carts.filter(c => c.share || c.owner !== user?.id).map(c => <article className="shared-card" key={c.id}><div className="shared-icon"><Users size={26}/></div><div><h3>{c.owner_name}’s {data.stores.find(s => s.id === c.store)?.name} cart</h3><p>{c.items.reduce((n: number, i: any) => n + i.quantity, 0)} items · {c.members.length + 1} shopper{c.members.length ? 's' : ''} · {c.owner === user.id ? 'You own this cart' : 'Guest access'}</p>{c.owner === user.id && <div className="shared-members"><h4>Cart members</h4>{c.members.length === 0 && <p>No guests have joined yet.</p>}{c.members.map((m: any) => <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}><span style={{ flex: 1 }}>{m.name}</span><button type="button" className="text-button" disabled={busy} aria-label={'Remove ' + m.name + ' from cart'} onClick={() => void onRemoveMember(c.id, m.id, m.name)}>Remove</button></div>)}{c.removedMembers?.length > 0 && <><h4>Removed members</h4>{c.removedMembers.map((m: any) => <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}><span style={{ flex: 1 }}>{m.name}</span><button type="button" className="text-button" disabled={busy} onClick={() => void onRestoreMember(c.id, m.id, m.name)}>Invite back</button></div>)}</>}</div>}</div><button className="primary" onClick={() => { onSelectStore(c.store); onSelectCart(c.id); onShop(); }}>Open cart</button></article>)}<form className="join-form" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget), v = String(f.get('invite')); let token = v; try {
            token = new URL(v).searchParams.get('share') || v;
        }
        catch { } const d = await act({ action: 'join', share: token }); if (d) {
            onSelectStore(d.carts.find((c: any) => c.id === d.cartId).store);
            onSelectCart(d.cartId);
            onShop();
            onNotice('Shared cart joined.');
        } }}><h3>Have an invitation?</h3><label>Cart invitation link<input name="invite" required placeholder="Paste a shared-cart link"/></label><button className="secondary" disabled={busy}>Join cart</button></form></>);
}
