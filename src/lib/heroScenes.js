export const HERO_SCENES = [
  {
    id: 'rashid-mongol-soldiers',
    categories: ['khans', 'warriors'],
    src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Mongol_soldiers_by_Rashid_al-Din_1305.JPG',
    title: { mn: 'Монголын Цэргүүд', en: 'Mongol Soldiers' },
    credit: 'Rashid al-Din · Jami al-Tawarikh · c. 1305',
    license: 'Public domain',
    fit: 'cover',
    position: 'center center',
  },
  {
    id: 'liu-kublai-hunt',
    categories: ['queens', 'political', 'cultural'],
    src: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Liu-Kuan-Tao-Jagd.JPG',
    title: { mn: 'Хубилай Хааны Анг', en: 'Kublai Khan Hunting' },
    credit: 'Liu Guandao · c. 1280',
    license: 'Public domain',
    fit: 'cover',
    position: 'center center',
  },
];

export function pickSceneForCategory(category) {
  return HERO_SCENES.find((s) => s.categories.includes(category)) || null;
}
