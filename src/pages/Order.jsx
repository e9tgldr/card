import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const TIER_INFO = {
  basic: {
    name: 'Энгийн хувилбар',
    price: '29,900₮',
    summary: '52 хөзөр бүхий стандарт багц',
  },
  premium: {
    name: 'Premium хувилбар',
    price: '49,900₮',
    summary: '52 + 4 тусгай хөзөр, 3 хэлний дэмжлэг, дуут тайлбар',
  },
  collector: {
    name: 'Collector Edition',
    price: '99,000₮',
    summary: '56 + 8 тусгай хөзөр, дугаарлагдсан, гарын үсэгтэй',
  },
};

export default function Order() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tierKey = searchParams.get('tier') || 'premium';
  const tier = TIER_INFO[tierKey] || TIER_INFO.premium;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Нэр, утас, хаяг — гурвууланг бөглөнө үү.');
      return;
    }
    setSubmitting(true);
    const { error: insErr } = await supabase.from('orders').insert({
      tier: tierKey in TIER_INFO ? tierKey : 'premium',
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_address: address.trim(),
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (insErr) {
      setError('Захиалга илгээгдсэнгүй. Дараа дахин оролдоно уу.');
      console.error('order insert failed', insErr);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
           style={{ background: '#0a0c14', color: '#e8d5a3' }}>
        <h1 className="font-playfair text-3xl sm:text-4xl mb-4" style={{ color: '#c9a84c' }}>
          Захиалга хүлээн авлаа
        </h1>
        <p className="font-cormorant text-lg max-w-md mb-2 opacity-80">
          {tier.name} — {tier.price}
        </p>
        <p className="font-cormorant text-base max-w-md mb-8 opacity-70">
          Бид удахгүй танай утсаар холбогдох болно.
        </p>
        <Link
          to="/"
          className="px-5 py-2 rounded border hover:bg-brass/10"
          style={{ borderColor: '#c9a84c' }}
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: '#0a0c14', color: '#e8d5a3' }}>
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-sm opacity-70 hover:opacity-100 mb-6"
        >
          ← Буцах
        </button>

        <div className="rounded-xl p-6 mb-6"
             style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(26,18,0,0.4)' }}>
          <h2 className="font-playfair text-xl font-bold mb-1" style={{ color: '#c9a84c' }}>
            {tier.name}
          </h2>
          <div className="font-playfair text-3xl font-black mb-2" style={{ color: '#c9a84c' }}>
            {tier.price}
          </div>
          <p className="font-cormorant opacity-80">{tier.summary}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h1 className="font-playfair text-2xl font-bold mb-2" style={{ color: '#e8d5a3' }}>
            Захиалгын мэдээлэл
          </h1>

          <label className="block">
            <span className="block text-sm mb-1 opacity-80">Нэр <span className="opacity-60">*</span></span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded text-foreground"
              style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(0,0,0,0.4)', color: '#e8d5a3' }}
            />
          </label>

          <label className="block">
            <span className="block text-sm mb-1 opacity-80">Утас <span className="opacity-60">*</span></span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="9911-2233"
              className="w-full px-3 py-2 rounded text-foreground"
              style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(0,0,0,0.4)', color: '#e8d5a3' }}
            />
          </label>

          <label className="block">
            <span className="block text-sm mb-1 opacity-80">Хаяг <span className="opacity-60">*</span></span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              rows={2}
              className="w-full px-3 py-2 rounded text-foreground"
              style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(0,0,0,0.4)', color: '#e8d5a3' }}
            />
          </label>

          <label className="block">
            <span className="block text-sm mb-1 opacity-80">Нэмэлт тэмдэглэл</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded text-foreground"
              style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(0,0,0,0.4)', color: '#e8d5a3' }}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm" style={{ color: '#e57373' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-5 py-3 rounded font-cormorant text-lg font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#c9a84c', color: '#0a0c14' }}
          >
            {submitting ? 'Илгээж байна…' : 'Захиалга илгээх'}
          </button>
        </form>
      </div>
    </div>
  );
}
