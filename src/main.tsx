import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/**
 * Legacy Vite bootstrap. We render nothing to decouple
 * this entry from the Next.js App Router build.
 */
const el = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (el) {
  createRoot(el).render(<></>);
}

// make this module a no-op
export {};
