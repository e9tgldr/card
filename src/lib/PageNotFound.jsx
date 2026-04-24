import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 rounded-full border-2 border-gold/30 flex items-center justify-center mx-auto">
          <span className="text-4xl">🏇</span>
        </div>
        <h1 className="font-cinzel text-5xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground font-body">Хуудас олдсонгүй</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-crimson hover:bg-crimson/90 text-white font-body text-sm rounded-full transition-colors"
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}