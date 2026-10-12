'use client';
import { Plus, Minus } from 'lucide-react';
import { products, priceFor, money } from '../catalog';

type Props = {
    product: (typeof products)[number];
    quantity: number;
    available: number;
    selectedStore: string;
    busy: boolean;
    onChange: (product: string, delta?: number) => void;
};

/** Displays product stock and quantity controls without owning cart state. */
export default function ProductCard({ product: p, quantity: q, available, selectedStore: selected, busy, onChange }: Props) {
    return <article className="product-card" key={p.id}><div className="product-picture" style={{ background: p.color }}><span role="img" aria-label={p.name}>{p.icon}</span>{available === 0 && <span className="stock-tag unavailable">Out of stock</span>}{available > 0 && available <= 5 && <span className="stock-tag">Only {available} left</span>}</div><div className="product-info"><strong>{money(priceFor(p.id, selected))}</strong><h4>{p.name}</h4><p>{p.unit}</p><div className="product-bottom"><span>{available > 0 ? `${available} available` : 'Out of stock'}</span>{q > 0 ? <div className="quantity"><button disabled={busy} onClick={() => void onChange(p.id, -1)} aria-label={'Remove one ' + p.name}><Minus size={14}/></button><b>{q}</b><button disabled={busy || q >= available} onClick={() => void onChange(p.id)} aria-label={'Add one ' + p.name}><Plus size={14}/></button></div> : <button className="add-button" aria-label={'Add ' + p.name} disabled={busy || available === 0} onClick={() => void onChange(p.id)}><Plus size={19}/></button>}</div></div></article>;
}
