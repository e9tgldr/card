import { useState } from 'react';

const MAX = 4;

export function useCompare() {
  const [compareList, setCompareList] = useState([]);
  const [compareMode, setCompareMode] = useState(false);

  const toggleCompare = (figId) => {
    setCompareList(prev => {
      if (prev.includes(figId)) return prev.filter(id => id !== figId);
      if (prev.length >= MAX) return prev;
      return [...prev, figId];
    });
  };

  const isInCompare = (figId) => compareList.includes(figId);

  const clearCompare = () => setCompareList([]);

  const removeFromCompare = (figId) => setCompareList(prev => prev.filter(id => id !== figId));

  return { compareList, compareMode, setCompareMode, toggleCompare, isInCompare, clearCompare, removeFromCompare };
}