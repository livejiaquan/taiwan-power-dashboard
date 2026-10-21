import { useEffect, useState } from 'react';

import { fetchCurves } from '../../js/curves-api.js';

// Curves refresh whenever a new core snapshot arrives (refreshKey changes).
export function useCurves(refreshKey) {
  const [state, setState] = useState({ curves: null, loaded: false });

  useEffect(() => {
    if (!refreshKey) return undefined;
    let cancelled = false;
    fetchCurves().then((curves) => {
      if (!cancelled) setState({ curves, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}
