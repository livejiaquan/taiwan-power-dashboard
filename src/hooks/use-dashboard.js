import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { createDashboardController } from '../../js/dashboard-controller.js';

export function useDashboard() {
  const controller = useMemo(() => createDashboardController(), []);

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return { ...snapshot, refresh: controller.refresh };
}
