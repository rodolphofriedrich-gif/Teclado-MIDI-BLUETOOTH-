import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAppServices } from './bootstrap';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root não encontrado no index.html');

startAppServices();

// StrictMode foi omitido de propósito: ele monta/desmonta efeitos duas vezes em desenvolvimento,
// o que duplicaria as conexões com o motor MIDI nativo.
createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
