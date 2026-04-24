import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mthk_my_team';

export function useMyTeam() {
  const [team, setTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
  }, [team]);

  const addToTeam = useCallback((figId) => {
    setTeam(prev => prev.includes(figId) ? prev : [...prev, figId]);
  }, []);

  const removeFromTeam = useCallback((figId) => {
    setTeam(prev => prev.filter(id => id !== figId));
  }, []);

  const toggleTeam = useCallback((figId) => {
    setTeam(prev => prev.includes(figId) ? prev.filter(id => id !== figId) : [...prev, figId]);
  }, []);

  const isInTeam = useCallback((figId) => team.includes(figId), [team]);

  const clearTeam = useCallback(() => setTeam([]), []);

  return { team, addToTeam, removeFromTeam, toggleTeam, isInTeam, clearTeam };
}