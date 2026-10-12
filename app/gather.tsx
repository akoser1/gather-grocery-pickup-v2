'use client';
import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, MapPin, Search, Plus, Minus, ShoppingCart, Package, Users, UserRound, LogOut, Store, Star, Clock, X, SlidersHorizontal, LockKeyhole, Share2, Check, Leaf, CreditCard, LoaderCircle, Navigation, ChevronDown, CheckCircle2 } from 'lucide-react';
import { products, stores as initialStores, categories, priceFor, money } from './catalog';
import ProductCard from './components/product-card';
import OrdersPage from './components/orders-page';
import SharedCartsPage from './components/shared-carts-page';
import AccountPage from './components/account-page';
import type { Snapshot } from './types';
const empty: Snapshot = { user: null, stores: initialStores, stock: [], carts: [], orders: [], employeeOrders: [], reviews: [] };
const statuses = ['confirmed', 'preparing', 'ready', 'collected'];
const statusLabel: Record<string, string> = { confirmed: 'Order confirmed', preparing: 'Getting it together', ready: 'Ready for pickup', collected: 'Picked up' };
function distance(lat: number, lng: number, a: number, b: number) { const r = Math.PI / 180, x = Math.sin((a - lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(a * r) * Math.sin((b - lng) * r / 2) ** 2; return 3959 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
export default function Gather() {
    const [data, setData] = useState<Snapshot>(empty), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [view, setView] = useState('shop'), [selected, setSelected] = useState('meijer'), [category, setCategory] = useState('All products'), [query, setQuery] = useState(''), [cartId, setCartId] = useState(''), [modal, setModal] = useState(''), [authMode, setAuthMode] = useState('login'), [mobileCart, setMobileCart] = useState(false), [shareUrl, setShareUrl] = useState(''), [reviewOrder, setReviewOrder] = useState<any>(null), [rating, setRating] = useState(5), [location, setLocation] = useState({ lat: 39.7684, lng: -86.1581, label: 'Indianapolis' }), [pickup, setPickup] = useState(''), [person, setPerson] = useState(''), [payment, setPayment] = useState('test-visa'), [staffTab, setStaffTab] = useState('orders');
    const modalRef = useRef<HTMLElement | null>(null);
    useEffect(() => { if (!modal)
        return; const previous = document.activeElement as HTMLElement; const el = modalRef.current; if (!el)
        return; document.body.style.overflow = 'hidden'; if (!el.contains(document.activeElement))
        el.querySelector<HTMLElement>('input,button,select,textarea')?.focus(); const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setModal('');
        setError('');
    } if (e.key === 'Tab') {
        const elements = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea,a[href],summary'));
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } }; document.addEventListener('keydown', handle); return () => { document.removeEventListener('keydown', handle); document.body.style.overflow = ''; previous?.focus(); }; }, [modal]);
    const dataRef = useRef(data);
    dataRef.current = data;
    async function refresh() { try {
        const r = await fetch('/api/gather');
        const d: any = await r.json();
        if (!r.ok)
            throw new Error(d.error);
        setData(d);
        setError('');
    }
    catch (e: any) {
        setError(e.message);
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { void refresh(); }, []);
    useEffect(() => { const t = setInterval(() => { if (!busy)
        void refresh(); }, 15000); return () => clearInterval(t); }, [busy]);
    async function act(payload: any) { setBusy(true); setError(''); try {
        const r = await fetch('/api/gather', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), d: any = await r.json();
        if (!r.ok)
            throw new Error(d.error);
        setData(d);
        return d;
    }
    catch (e: any) {
        setError(e.message);
        return null;
    }
    finally {
        setBusy(false);
    } }
    useEffect(() => { if (!data.user)
        return; const token = new URLSearchParams(window.location.search).get('share'); if (token) {
        void (async () => { const d = await act({ action: 'join', share: token }); if (d) {
            setCartId(d.cartId);
            setSelected(d.carts.find((c: any) => c.id === d.cartId)?.store || 'meijer');
            setNotice('You joined a shared cart. Add items together; the owner will check out.');
            window.history.replaceState({}, '', window.location.pathname);
        } })();
    } }, [data.user?.id]);
    useEffect(() => { if (!notice)
        return; const t = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(t); }, [notice]);
    const user = data.user, store = data.stores.find(s => s.id === selected) || data.stores[0];
    const cart = data.carts.find(c => c.id === cartId && c.store === selected) || data.carts.find(c => c.store === selected && c.owner === user?.id);
    const owner = cart ? cart.owner === user?.id : true;
    const count = cart?.items.reduce((n: number, i: any) => n + i.quantity, 0) || 0;
    const subtotal = cart?.items.reduce((n: number, i: any) => n + priceFor(i.product, cart.store) * i.quantity, 0) || 0, fee = count ? 299 : 0, tax = count ? Math.round((subtotal + fee) * .07) : 0;
    const stocks = (p: any, storeId = selected) => data.stock.find(s => s.store === storeId && s.product === p.id)?.available ?? p.stock;
    const results = products.filter(p => (category === 'All products' || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
    async function add(product: string, delta = 1) { if (!user) {
        setModal('auth');
        return { error: 'Sign in first' };
    } let id = cart?.id; if (!id) {
        const d = await act({ action: 'cart', store: selected });
        if (!d)
            return { error: 'Cart could not be created' };
        id = d.cartId;
        setCartId(id);
    } const d = await act({ action: 'item', cart: id, product, delta }); return d ? { cartId: id, product, quantity: d.carts.find((c: any) => c.id === id)?.items.find((i: any) => i.product === product)?.quantity || 0 } : { error: 'Could not update cart' }; }
    const addRef = useRef(add);
    addRef.current = add;
    useEffect(() => { const ctx = (document as any).modelContext; if (!ctx?.registerTool)
        return; const lifecycle = new AbortController(); for (const tool of [{ name: 'get_gather_cart', description: 'Read the visible grocery cart and its quantities.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => { const d = dataRef.current; return { carts: d.carts.map(c => ({ id: c.id, store: c.store, items: c.items })) }; } }, { name: 'add_gather_product', description: 'Add one catalog product to the currently selected cart. Sign-in is required.', inputSchema: { type: 'object', properties: { productId: { type: 'string', enum: products.map(p => p.id) } }, required: ['productId'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input: any) => { if (!input || Object.keys(input).length !== 1 || !products.some(p => p.id === input.productId))
                throw new Error('Invalid productId'); return addRef.current(input.productId); } }])
        try {
            Promise.resolve(ctx.registerTool(tool, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { } return () => lifecycle.abort(); }, []);
    function chooseStore(id: string) { setSelected(id); setCartId(''); setCategory('All products'); setQuery(''); setView('shop'); }
    function openCheckout() { if (!count)
        return; if (!owner) {
        setNotice('Only the cart owner can check out.');
        return;
    } const t = new Date(Date.now() + 86400000); t.setHours(17, 0, 0, 0); setPickup(new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); setPerson(user.name); setPayment(user.payment); setModal('checkout'); }
    async function share() { const d = await act({ action: 'share', cart: cart.id }); if (d) {
        setShareUrl(window.location.origin + '/?share=' + d.share);
        setModal('share');
    } }
    async function removeMember(cartId: string, memberId: string, name: string) {
        if (!window.confirm('Remove ' + name + ' from this cart? They will not be able to rejoin with the old invitation link.')) return;
        if (await act({ action: 'removeMember', cart: cartId, member: memberId })) setNotice(name + ' has been removed from this cart.');
    }
    async function restoreMember(cartId: string, memberId: string, name: string) {
        if (await act({ action: 'restoreMember', cart: cartId, member: memberId })) setNotice(name + ' has been invited back to this cart.');
    }
    async function geolocate() { if (!navigator.geolocation) {
        setError('Location is unavailable in this browser.');
        return;
    } navigator.geolocation.getCurrentPosition(p => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'your location' }); setModal(''); }, () => setError('Location access was unavailable. You can browse the sample Indianapolis stores.')); }
    const sorted = data.stores.map(s => ({ ...s, distance: distance(location.lat, location.lng, s.lat, s.lng) })).filter(s => s.distance <= 25).sort((a, b) => a.distance - b.distance);
    function close() { setModal(''); setError(''); }
    const nav = [{ id: 'shop', label: 'Shop stores', Icon: Store }, { id: 'orders', label: 'My orders', Icon: Package }, { id: 'shared', label: 'Shared carts', Icon: Users }, { id: 'account', label: 'My account', Icon: UserRound }, ...(user?.role === 'employee' ? [{ id: 'employee', label: 'Employee desk', Icon: SlidersHorizontal }] : [])];
    return <div className="app">
    <header className="topbar"><a className="wordmark" href="/" aria-label="Gather home"><span className="brand-icon"><ShoppingBag size={24}/></span>gather<span className="wordmark-dot">.</span></a><button className="location-button" onClick={() => setModal('location')}><MapPin size={19}/><span><small>Pickup near</small><strong>{location.label}</strong></span><ChevronDown size={15}/></button><div className="header-end"><span className="test-label">Class prototype</span><button className="header-account" onClick={() => user ? setView('account') : setModal('auth')}><UserRound size={19}/>{user ? user.name.split(' ')[0] : 'Sign in'}</button><button className="mobile-cart-button" onClick={() => setMobileCart(!mobileCart)} aria-label="Open cart"><ShoppingCart size={21}/><b>{count}</b></button></div></header>
    <div className="shell"><aside className="sidebar"><div className="nav-label">YOUR EVERYDAY</div><nav>{nav.map(n => <button key={n.id} className={view === n.id ? 'nav-item active' : 'nav-item'} onClick={() => { if (!user && n.id !== 'shop') {
        setModal('auth');
        return;
    } setView(n.id); }}><n.Icon size={20}/><span>{n.label}</span>{n.id === 'orders' && data.orders.length > 0 && <small>{data.orders.length}</small>}</button>)}</nav><div className="sidebar-foot"><span className="pickup-mark"><ShoppingBag size={25}/></span><strong>A little less errand.</strong><p>Shop together.<br />Pick up on your time.</p><div className="tiny-label">PICKUP ONLY · NO DELIVERY</div></div>{user && <button className="signout" onClick={async () => { await act({ action: 'logout' }); setView('shop'); setCartId(''); }}><LogOut size={17}/>Sign out</button>}</aside>
    <main className="workspace">{error && <div className="alert error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}{notice && <div className="alert success" role="status"><CheckCircle2 size={18}/>{notice}</div>}
        {loading ? <div className="loading"><LoaderCircle className="spin"/>Loading your neighborhood…</div> : <>
            {view === 'shop' && <>
            <div className="page-eyebrow"><span /> YOUR NEIGHBORHOOD, IN YOUR BAG</div><div className="page-heading"><div><h1>Good groceries. Less running around.</h1><p>Choose your store, fill your cart, and pick it up.</p></div></div>
            <div className="shop-banner"><div><span className="pill"><Leaf size={13}/>Fresh starts here</span><h2>Make room for<br />the good stuff.</h2><p>All your essentials. One easy pickup.</p></div><img src="/images/market.jpg" alt="Fresh vegetables arranged in a grocery store"/><span className="banner-note">YOU SHOP. WE’LL BAG.</span></div>
            <div className="section-heading"><h2>Stores near you <span>{sorted.length}</span></h2><button className="text-button" onClick={() => setModal('location')}><MapPin size={15}/>Change location</button></div><p className="sample-note">Sample locations and inventory for Indianapolis. Prices and hours are demonstration data.</p>
            <div className="store-grid">{sorted.map(s => { const rr = data.reviews.filter(r => r.store === s.id), avg = rr.length ? (rr.reduce((n, r) => n + r.rating, 0) / rr.length).toFixed(1) : null; return <button className={'store-card ' + (selected === s.id ? 'selected' : '')} key={s.id} onClick={() => chooseStore(s.id)}><div className="store-top"><span className={'store-logo ' + s.id} style={{ color: s.color }}>{s.name === 'Meijer' ? 'meijer' : s.name === 'Walmart' ? <>Walmart<span className="spark">✳</span></> : s.name}</span><span className={'selection ' + (selected === s.id ? 'checked' : '')}>{selected === s.id && <Check size={12}/>}</span></div><div className="store-meta"><span>{s.distance.toFixed(1)} mi away</span><span>{avg ? <><Star size={12} fill="currentColor"/>{avg} ({rr.length})</> : 'No reviews yet'}</span></div><div className="store-caption">{s.tag}</div></button>; })}</div>{!sorted.length && <div className="empty-box"><MapPin /><h3>No sample stores within 25 miles.</h3><p>This prototype includes Indianapolis stores.</p><button className="primary" onClick={() => setLocation({ lat: 39.7684, lng: -86.1581, label: 'Indianapolis' })}>Browse sample stores</button></div>}
            <div className="inventory-header"><div><span className="page-eyebrow">SHOPPING AT</span><h2>{store.name}<button className="reviews-link" onClick={() => setModal('reviews')}><Star size={15}/>Customer reviews</button></h2><p><MapPin size={14}/>{store.address}<span className="separator">·</span><Clock size={14}/>{store.hours}</p></div></div>
            <div className="searchbar"><Search size={20}/><input aria-label="Search store inventory" placeholder={'Search ' + store.name + ' groceries'} value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={17}/></button>}</div><div className="category-tabs" role="group" aria-label="Product categories">{categories.map(c => <button className={category === c ? 'category active' : 'category'} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="section-heading"><h3>{query ? 'Search results' : category === 'All products' ? 'Everyday favorites' : category}</h3><span className="muted">{results.length} products</span></div>
            <div className="product-grid">{results.map(p => <ProductCard key={p.id} product={p} quantity={cart?.items.find((i: any) => i.product === p.id)?.quantity || 0} available={stocks(p)} selectedStore={selected} busy={busy} onChange={add}/>)}</div>{!results.length && <div className="empty-box"><Search /><h3>No products found</h3><p>Try another name or category.</p></div>}
            </>}
        {view === 'orders' && <OrdersPage data={data} onShop={() => setView('shop')} onReview={o => { setReviewOrder(o); setRating(5); setModal('review'); }}/>} 
        {view === 'shared' && <SharedCartsPage data={data} user={user} busy={busy} act={act} onShop={() => setView('shop')} onSelectStore={setSelected} onSelectCart={setCartId} onNotice={setNotice} onRemoveMember={removeMember} onRestoreMember={restoreMember}/>} 
        {view === 'account' && user && <AccountPage user={user} busy={busy} act={act} onNotice={setNotice}/>} 
        {view === 'employee' && user?.role === 'employee' && <><span className="page-eyebrow">{data.stores.find(s => s.id === user.store)?.name} · EMPLOYEE WORKSPACE</span><h1>Pickup desk</h1><p className="intro">Get orders ready for a good handoff.</p><div className="category-tabs">{['orders', 'inventory', 'store'].map(t => <button key={t} onClick={() => setStaffTab(t)} className={'category ' + (staffTab === t ? 'active' : '')}>{t === 'orders' ? 'Pickup orders' : t === 'inventory' ? 'Inventory' : 'Store details'}</button>)}</div>{staffTab === 'orders' && (data.employeeOrders.length ? data.employeeOrders.map(o => <article className="employee-order" key={o.id}><div className="order-head"><div><span className="page-eyebrow">{o.id}</span><h3>{o.customer}</h3></div><span className={'status ' + o.status}>{statusLabel[o.status]}</span></div><p>Pickup: {o.person} · {new Date(o.pickup).toLocaleString('en-US', { timeZone: 'America/Indiana/Indianapolis' })}</p><div className="receipt">{o.lines.map((i: any) => <div key={i.product}><span>{i.quantity} × {i.name}</span></div>)}</div>{o.status !== 'collected' && <button className="primary" disabled={busy} onClick={async () => { if (await act({ action: 'status', order: o.id, status: statuses[statuses.indexOf(o.status) + 1] }))
            setNotice('Order status updated.'); }}>{o.status === 'confirmed' ? 'Start preparing' : o.status === 'preparing' ? 'Mark ready for pickup' : 'Confirm pickup'}</button>}</article>) : <div className="empty-box"><Package /><h3>No pickup orders yet</h3><p>Orders placed at your store will appear here.</p></div>)}{staffTab === 'inventory' && <div className="panel stock-panel">{products.map(p => <form className="stock-row" key={p.id} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await act({ action: 'stock', product: p.id, available: Number(f.get('available')) }))
            setNotice('Inventory updated.'); }}><span className="stock-emoji">{p.icon}</span><strong>{p.name}</strong><label className="sr-only" htmlFor={'stock-' + p.id}>Available {p.name}</label><input id={'stock-' + p.id} key={stocks(p, user.store)} name="available" type="number" min="0" max="999" required defaultValue={stocks(p, user.store)}/><button className="secondary" disabled={busy}>Save</button></form>)}</div>}{staffTab === 'store' && <form className="panel account-form" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: 'storeEdit', ...Object.fromEntries(new FormData(e.currentTarget)) }))
            setNotice('Store details updated.'); }}>{['name', 'address', 'hours'].map(k => <label key={k}>{k === 'name' ? 'Store name' : k === 'address' ? 'Address' : 'Opening hours'}<input required maxLength={250} name={k} defaultValue={data.stores.find(s => s.id === user.store)?.[k]}/></label>)}<button className="primary" disabled={busy}>Save store details</button></form>}</>}
        </>}
    <footer className="content-footer"><span>gather.</span> A class prototype. Sample stores, test payments, real teamwork.</footer>
    </main>
    <aside className={'cart-panel ' + (mobileCart ? 'mobile-open' : '')}><div className="cart-title"><h2>Your cart <span>{count}</span></h2><button className="close-cart" onClick={() => setMobileCart(false)} aria-label="Close cart"><X size={20}/></button></div><div className="cart-store"><ShoppingBag size={17}/><span>Pickup at <strong>{store.name}</strong></span></div>{cart && <div className="cart-owner"><Users size={14}/>{owner ? 'Your cart' : cart.owner_name + '’s shared cart'}{cart.members.length > 0 && <span> · {cart.members.length + 1} shoppers</span>}</div>}
    {!count ? <div className="cart-empty"><span><ShoppingBag size={38} strokeWidth={1.3}/></span><h3>Good things go here.</h3><p>Add a few favorites to start<br />your next grocery pickup.</p></div> : <><div className="cart-items">{cart.items.map((i: any) => { const p = products.find(p => p.id === i.product)!; return <div className="cart-item" key={i.product}><span className="cart-item-picture" style={{ background: p.color }}>{p.icon}</span><div><h4>{p.name}</h4><p>{money(priceFor(p.id, selected))} each</p><div className="quantity"><button disabled={busy} onClick={() => void add(p.id, -1)} aria-label={'Remove one ' + p.name}><Minus size={12}/></button><b>{i.quantity}</b><button disabled={busy || i.quantity >= stocks(p)} onClick={() => void add(p.id)} aria-label={'Add one ' + p.name}><Plus size={12}/></button></div></div><strong>{money(priceFor(p.id, selected) * i.quantity)}</strong></div>; })}</div>{owner && <button className="share-cart" disabled={busy} onClick={() => void share()}><Share2 size={16}/>Share cart<span>Shop together</span></button>}<div className="cart-totals"><div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Service fee <small>flat fee</small></span><span>{money(fee)}</span></div><div><span>Estimated tax <small>7%</small></span><span>{money(tax)}</span></div><div className="cart-total"><strong>Total</strong><strong>{money(subtotal + fee + tax)}</strong></div></div><button className="checkout-button" disabled={busy || !owner} onClick={openCheckout}><LockKeyhole size={17}/>{owner ? 'Secure checkout' : 'Owner checks out'}<span>{money(subtotal + fee + tax)}</span></button><p className="checkout-note">Test checkout · No real charge</p></>}
    <div className="cart-bottom"><div><Clock size={19}/><span><strong>Ready on your schedule</strong><small>Choose a pickup time at checkout.</small></span></div><div><Users size={19}/><span><strong>One cart. Everyone’s favorites.</strong><small>Invite your family to add what they need.</small></span></div></div></aside></div>
        {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            close(); }}><section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-label={modal === 'auth' ? 'Account sign in' : modal === 'checkout' ? 'Secure checkout' : modal === 'review' ? 'Write a review' : modal === 'share' ? 'Share cart' : modal === 'reviews' ? 'Customer reviews' : 'Choose location'} onKeyDown={e => { if (e.key === 'Escape')
            close(); }}><button className="modal-close" aria-label="Close dialog" onClick={close}><X size={21}/></button>{error && <div className="alert error" role="alert">{error}</div>}
        {modal === 'auth' && <><span className="brand-icon"><ShoppingBag size={24}/></span><h2>{authMode === 'login' ? 'Welcome back.' : 'Your next pickup starts here.'}</h2><p className="muted">{authMode === 'login' ? 'Sign in to shop, share, and pick up.' : 'Create an account to start your grocery cart.'}</p><form onSubmit={async (e) => { e.preventDefault(); if (await act({ action: authMode, ...Object.fromEntries(new FormData(e.currentTarget)) })) {
            close();
            setNotice(authMode === 'login' ? 'Welcome back!' : 'Your account is ready.');
        } }}>{authMode === 'signup' && <label>Full name<input autoFocus name="name" required maxLength={80} autoComplete="name"/></label>}<label>Email address<input autoFocus={authMode === 'login'} type="email" name="email" required autoComplete="email"/></label><label>Password<input type="password" name="password" required minLength={8} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}/></label><button className="primary full" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="text-button auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); }}>{authMode === 'login' ? 'New to Gather? Create an account' : 'Already have an account? Sign in'}</button><details className="demo-accounts"><summary>Try a demo account</summary><p>All demo passwords: <strong>Gather123!</strong></p>{[{ email: 'alex@gather.test', label: 'Alex · customer' }, { email: 'jamie@gather.test', label: 'Jamie · shared-cart guest' }, { email: 'staff@gather.test', label: 'Sam · Meijer employee' }].map(a => <button className="demo-button" disabled={busy} key={a.email} onClick={async () => { if (await act({ action: 'login', email: a.email, password: 'Gather123!' })) {
            close();
            setNotice('Signed in as ' + a.label);
        } }}>{a.label}</button>)}</details></>}
        {modal === 'checkout' && <><span className="page-eyebrow">LET’S GET IT READY</span><h2>Secure checkout</h2><p className="muted">Pickup at {store.name} · {count} items</p><form onSubmit={async (e) => { e.preventDefault(); const d = await act({ action: 'checkout', cart: cart.id, payment, pickup: new Date(pickup).toISOString(), person }); if (d) {
            close();
            setMobileCart(false);
            setView('orders');
            setCartId('');
            setNotice('Order ' + d.orderId + ' confirmed. We’ll keep your pickup status updated here.');
        } }}><label>Pickup date & time<input type="datetime-local" required value={pickup} onChange={e => setPickup(e.target.value)}/><small>Use your browser’s local time. Store hours are in Indianapolis.</small></label><label>Who’s picking up?<input required maxLength={80} value={person} onChange={e => setPerson(e.target.value)}/></label><label>Payment method<select value={payment} onChange={e => setPayment(e.target.value)}><option value="test-visa">Test Visa ending in 4242</option><option value="test-mastercard">Test Mastercard ending in 4444</option></select></label><div className="receipt"><div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Flat service fee</span><span>{money(fee)}</span></div><div><span>Estimated tax (7%)</span><span>{money(tax)}</span></div><div className="total"><strong>Total</strong><strong>{money(subtotal + fee + tax)}</strong></div></div><p className="test-payment"><LockKeyhole size={17}/>Test order only. No payment will be collected.</p><button className="primary full" disabled={busy}>{busy ? 'Placing order…' : 'Place pickup order · ' + money(subtotal + fee + tax)}</button></form></>}
        {modal === 'share' && <><span className="modal-symbol"><Users size={30}/></span><h2>A cart for the whole crew.</h2><p>Send this link to another Gather user. They can add products; only you can check out.</p><label>Invitation link<input readOnly value={shareUrl} onFocus={e => e.target.select()}/></label><button className="primary full" onClick={async () => { try {
            await navigator.clipboard.writeText(shareUrl);
            setNotice('Invitation link copied.');
        }
        catch {
            setNotice('Select and copy the invitation link above.');
        } }}>Copy invitation link</button><p className="muted">Guests need an account. Another device must be able to reach this local server.</p></>}
        {modal === 'location' && <><MapPin size={30}/><h2>What’s your neighborhood?</h2><p>Sort sample stores by distance from your location. This class prototype includes stores around Indianapolis.</p><button className="primary full" onClick={() => void geolocate()}><Navigation size={17}/>Use my location</button><button className="secondary full" onClick={() => { setLocation({ lat: 39.7684, lng: -86.1581, label: 'Indianapolis' }); close(); }}>Browse sample Indianapolis stores</button><p className="muted">Your coordinates stay in this browser session.</p></>}
        {modal === 'reviews' && <><span className="page-eyebrow">FROM PEOPLE WHO PICKED UP</span><h2>{store.name} reviews</h2><p className="muted">Only customers with an order at this store can leave a review.</p>{data.reviews.filter(r => r.store === selected).length === 0 ? <div className="empty-box"><Star /><h3>No reviews just yet.</h3><p>Place an order to share your experience.</p></div> : data.reviews.filter(r => r.store === selected).map(r => <article className="review-card" key={r.id}><strong>{r.name}</strong><div className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div><p>{r.comment}</p><small>Verified order · {new Date(r.created).toLocaleDateString()}</small></article>)}</>}
        {modal === 'review' && <><Star size={30}/><h2>How was your pickup?</h2><p className="muted">{data.stores.find(s => s.id === reviewOrder.store)?.name} · Order {reviewOrder.id}</p><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await act({ action: 'review', order: reviewOrder.id, rating, comment: f.get('comment') })) {
            close();
            setNotice('Thanks! Your customer review is now on the store.');
        } }}><div className="rating-buttons" role="group" aria-label="Rating">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} onClick={() => setRating(n)} aria-label={n + ' stars'} aria-pressed={rating === n}><Star size={32} fill={n <= rating ? 'currentColor' : 'none'}/></button>)}</div><label>Your review<textarea name="comment" required minLength={3} maxLength={1000} rows={4} placeholder="Tell other shoppers about your experience."/></label><button className="primary full" disabled={busy}>Submit review</button></form></>}
        </section></div>}
    </div>;
}
