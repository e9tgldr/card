import React from 'react';
import GoldDivider from './GoldDivider';

export default function Footer() {
  return (
    <footer className="py-12 sm:py-16 px-4 sm:px-6" style={{ background: '#080a10' }}>
      <div className="max-w-4xl mx-auto text-center">
        <GoldDivider />
        <div className="mt-12 mb-6">
          <h3 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-black tracking-wider" style={{ color: '#c9a84c' }}>
            ALTAN DOMOG
          </h3>
        </div>
        <p
          className="font-cormorant text-sm sm:text-base md:text-lg tracking-[0.2em] sm:tracking-widest uppercase mb-10 px-2"
          style={{ color: '#e8d5a360' }}
        >
          НЭГ ХӨЗӨР – НЭГ ТҮҮХ, НЭГ QR – НЭГ АЯЛАЛ
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-8 mb-10">
          <a href="#" className="font-cormorant text-base transition-colors duration-300" style={{ color: '#e8d5a350' }}
            onMouseEnter={(e) => e.target.style.color = '#c9a84c'}
            onMouseLeave={(e) => e.target.style.color = '#e8d5a350'}
          >
            Бидний тухай
          </a>
          <a href="#" className="font-cormorant text-base transition-colors duration-300" style={{ color: '#e8d5a350' }}
            onMouseEnter={(e) => e.target.style.color = '#c9a84c'}
            onMouseLeave={(e) => e.target.style.color = '#e8d5a350'}
          >
            Холбоо барих
          </a>
          <a href="#" className="font-cormorant text-base transition-colors duration-300" style={{ color: '#e8d5a350' }}
            onMouseEnter={(e) => e.target.style.color = '#c9a84c'}
            onMouseLeave={(e) => e.target.style.color = '#e8d5a350'}
          >
            Нөхцөл
          </a>
        </div>
        <p className="font-cormorant text-sm" style={{ color: '#e8d5a320' }}>
          © 2026 Altan Domog. Бүх эрх хуулиар хамгаалагдсан.
        </p>
      </div>
    </footer>
  );
}
