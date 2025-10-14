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
  console.log('🚀 Iniciando App...');
  console.log('1️⃣ React render started');

  try {
    console.log('2️⃣ Inside try block');

    return (
      <ErrorBoundary>
        <div style={{padding: '20px', fontFamily: 'monospace', background: '#fff'}}>
          <h1>🧪 DEBUGGING STEP-BY-STEP</h1>
          <div>
            <p>✅ 1. Basic React render: OK</p>
            <p>⏳ 2. Testing imports...</p>
          </div>
        </div>
        <BrowserRouter>
          <div style={{padding: '10px', margin: '10px', background: '#f0f0f0'}}>
            <p>⏳ 3. BrowserRouter tested...</p>
          </div>
          <LanguageProvider>
            <div style={{padding: '10px', margin: '10px', background: '#e0e0e0'}}>
              <p>⏳ 4. LanguageProvider tested...</p>
            </div>
            <WarehouseProvider>
              <div style={{padding: '10px', margin: '10px', background: '#d0d0d0'}}>
                <p>⏳ 5. WarehouseProvider tested...</p>
              </div>
              <div style={{padding: '20px', background: 'red', color: 'white'}}>
                <p>🚨 CRITICAL: Next component (Pages) is causing the error!</p>
                <p>If you can see this, press F12 → Console for detailed errors</p>
              </div>
              <Pages />
            </WarehouseProvider>
          </LanguageProvider>
        </BrowserRouter>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('❌ ERROR INICIANDO APP:', error);
    return (
      <div style={{padding: '20px', fontFamily: 'monospace', background: 'red', color: 'white'}}>
        <h1>❌ ERROR CRÍTICO INICIANDO APP</h1>
        <pre style={{background: '#fff', padding: '10px'}}>
          {error.message}
          {error.stack}
        </pre>
      </div>
    );
  }
}

export default App;
