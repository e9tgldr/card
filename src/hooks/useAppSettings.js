import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const DEFAULTS = { site_name: 'Altan Domog', site_logo: '🏇' };

export function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    base44.entities.AppSettings.list().then(list => {
      const map = { ...DEFAULTS };
      list.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
    }).catch(() => {});

    const unsub = base44.entities.AppSettings.subscribe(() => {
      base44.entities.AppSettings.list().then(list => {
        const map = { ...DEFAULTS };
        list.forEach(s => { map[s.key] = s.value; });
        setSettings(map);
      }).catch(() => {});
    });
    return unsub;
  }, []);

  const saveSetting = async (key, value, allSettings) => {
    const existing = await base44.entities.AppSettings.filter({ key });
    if (existing.length > 0) {
      await base44.entities.AppSettings.update(existing[0].id, { key, value });
    } else {
      await base44.entities.AppSettings.create({ key, value });
    }
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, saveSetting };
}