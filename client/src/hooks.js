import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useAdminData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await api.data());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}

// Preview URL for a file the person just picked.
export function useObjectUrl(file) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) {
      setUrl('');
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function formatAdded(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
