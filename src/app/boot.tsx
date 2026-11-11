// The page before the app's screen (real only): the 받는 중 line as plain text, then the app replaces it, or the 오류 화면.
import { createRoot } from 'react-dom/client';
import { LoadError, LOADING_TEXT } from '@ui/LoadError';
import type { BootScreen } from './backend';

export const bootScreen = (el: HTMLElement): BootScreen => ({
  loading: () => void (el.textContent = LOADING_TEXT), // no React yet: shown before the bundle's screen is built
  error: (reason) => createRoot(el).render(<LoadError reason={reason} onRetry={() => location.reload()} />),
});
