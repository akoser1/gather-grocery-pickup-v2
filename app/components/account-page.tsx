'use client';

type Props = { user: any; busy: boolean; act: (payload: any) => Promise<any>; onNotice: (notice: string) => void };

/** Customer profile editor. */
export default function AccountPage({user,busy,act,onNotice}: Props) {
    return (<><span className="page-eyebrow">YOUR GATHER DETAILS</span><h1>My account</h1><p className="intro">Keep your pickup details handy.</p><form className="account-form panel" onSubmit={async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); if (await act({ action: 'profile', ...f }))
            onNotice('Your account details have been saved.'); }}><h3>Personal information</h3><label>Full name<input name="name" required maxLength={80} defaultValue={user.name}/></label><label>Email<input readOnly value={user.email}/></label><label>Phone number<input name="phone" type="tel" maxLength={30} defaultValue={user.phone} placeholder="(555) 123-4567"/></label><label>Address<input name="address" maxLength={250} defaultValue={user.address} placeholder="Street address, city, state, ZIP"/></label><h3>Saved payment method</h3><p className="muted">Test cards only. This prototype never charges a card.</p><label>Payment method<select name="payment" defaultValue={user.payment}><option value="test-visa">Test Visa ending in 4242</option><option value="test-mastercard">Test Mastercard ending in 4444</option></select></label><button className="primary" disabled={busy}>Save account</button></form></>);
}
