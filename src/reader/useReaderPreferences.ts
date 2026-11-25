import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_READER_PREFERENCES, parseReaderPreferences, type ReaderPreferences } from './preferences';

const STORAGE_KEY = 'noval.reader.preferences.v1';
let writes: Promise<unknown> = Promise.resolve();

export function useReaderPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_READER_PREFERENCES);
  const current = useRef(preferences);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    writes.then(() => AsyncStorage.getItem(STORAGE_KEY)).then(raw => {
      if (!active) return;
      current.current = parseReaderPreferences(raw ? JSON.parse(raw) : null);
      setPreferences(current.current);
    }).catch(() => {
      if (active) setError('阅读设置读取失败，暂时使用默认设置。');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; mounted.current = false; };
  }, []);

  function update(patch: Partial<ReaderPreferences>) {
    const next = parseReaderPreferences({ ...current.current, ...patch });
    current.current = next;
    setPreferences(next);
    const operation = writes.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)));
    writes = operation.catch(() => undefined);
    operation.then(() => { if (mounted.current) setError(''); })
      .catch(() => { if (mounted.current) setError('阅读设置保存失败，请检查存储空间后重新设置。'); });
  }

  return { preferences, ready, error, update };
}
