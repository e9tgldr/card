import React from 'react';
import { Link } from 'react-router-dom';

export default function GoldButton({ children, className = '', onClick, to, href }) {
  const base = `px-8 py-3 rounded-full font-cormorant text-lg font-semibold tracking-wider uppercase transition-all duration-300 inline-flex items-center justify-center ${className}`;
  const style = {
    border: '1.5px solid #c9a84c',
    color: '#e8d5a3',
    background: 'transparent',
  };
  const hoverOn = (e) => (e.currentTarget.style.background = 'rgba(201,168,76,0.15)');
  const hoverOff = (e) => (e.currentTarget.style.background = 'transparent');

  if (to) {
    return (
      <Link to={to} className={base} style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={base} style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={base} style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
      {children}
    </button>
  );
}
