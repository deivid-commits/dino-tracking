import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './components/LanguageProvider';
import { WarehouseProvider } from './components/WarehouseProvider';
import Pages from './pages/index';
import { Toaster } from './components/ui/toaster';
import './App.css';

// 🔧 ERROR BOUNDARY PARA CAPTURAR ERRORES
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ERROR EN APP:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', fontFamily: 'monospace'}}>
          <h1>❌ ERROR EN LA APLICACIÓN</h1>
          <pre style={{color: 'red', background: '#f5f5f5', padding: '10px', borderRadius: '4px'}}>
            {this.state.error?.message || this.state.error?.toString() || 'Error desconocido'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              marginTop: '10px',
              cursor: 'pointer'
            }}
          >
            ♻️ Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <WarehouseProvider>
            <Pages />
          </WarehouseProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
