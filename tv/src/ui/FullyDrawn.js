// Emits Vega's `fully_drawn` trace marker (the TTFD launch KPI) once the app has something interactive on
// screen, and again when it returns to the foreground (warm start), as described in the Vega guide
// vega_use_report_fully_drawn.md. Renders nothing.
import { useEffect, useRef } from 'react';
import { useReportFullyDrawn } from '@amazon-devices/kepler-performance-api';
import { useKeplerAppStateManager } from '@amazon-devices/react-native-kepler';

export function FullyDrawnMarker({ ready }){
  const report = useReportFullyDrawn();
  const mgr = useKeplerAppStateManager();
  const reported = useRef(false);

  // Cold start: first time the UI is ready.
  useEffect(() => {
    if (ready && !reported.current) { reported.current = true; report(); }
  }, [ready, report]);

  // Warm start: background/inactive → active.
  useEffect(() => {
    let last = mgr.getCurrentState();
    const sub = mgr.addAppStateListener('change', next => {
      if (/^(inactive|background)$/.test(last) && next === 'active' && reported.current) report();
      if (/^(inactive|background|active|unknown)$/.test(next)) last = next;
    });
    return () => sub.remove();
  }, [mgr, report]);

  return null;
}
