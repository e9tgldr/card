import { useEffect } from 'react';

const SITE_URL = 'https://altandomog.mn';

export function siteUrl(path = '/') {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`);
}

export default function JsonLd({ id, data }) {
  useEffect(() => {
    if (!data) return undefined;
    const scriptId = id ? `ld-${id}` : `ld-${Math.random().toString(36).slice(2)}`;
    let el = document.getElementById(scriptId);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = scriptId;
      document.head.appendChild(el);
    }
    try {
      el.textContent = JSON.stringify(data);
    } catch {
      el.textContent = '{}';
    }
    return () => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [id, data]);

  return null;
}
