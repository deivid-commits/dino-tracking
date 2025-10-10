import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Componente de Login de Operarios
function OperatorLogin({ onLoginSuccess }) {
  const [loginCode, setLoginCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (loginCode.length !== 4) {
      setError('El código debe tener 4 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Buscar operario en la base de datos (por ahora simulamos)
      // TODO: Implementar búsqueda real en tabla de operadores
      const mockOperator = {
        id: '1',
        name: 'Operario Demo',
        code: loginCode,
        is_admin: false,
        permissions: ['dashboard', 'components', 'dinosaurs', 'devices']
      };

      onLoginSuccess(mockOperator);
    } catch (error) {
      setError('Error en el login: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '40px'
          }}>
            🦖
          </div>
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '24px' }}>DinoTrack</h1>
          <p style={{ margin: '5px 0 0 0', color: '#7f8c8d' }}>Sistema de Gestión</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <input
            type="password"
            placeholder="Código de Operario (4 dígitos)"
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            maxLength="4"
            style={{
              width: '100%',
              padding: '15px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '18px',
              textAlign: 'center',
              letterSpacing: '3px',
              boxSizing: 'border-box'
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && (
          <div style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '20px',
            border: '1px solid #ffcdd2'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || loginCode.length !== 4}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: loginCode.length === 4 ? '#667eea' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loginCode.length === 4 ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? '🔄 Verificando...' : '🚪 Iniciar Sesión'}
        </button>

        <div style={{ marginTop: '20px', fontSize: '14px', color: '#7f8c8d' }}>
          <p>💡 Ingresa tu código de 4 dígitos</p>
          <p>⏰ Sesión expira automáticamente después de 10 minutos de inactividad</p>
        </div>
      </div>
    </div>
  );
}

// Componente Principal de la Aplicación
function DinoTrackApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeWarehouse, setActiveWarehouse] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadWarehouses();
    }
  }, [currentUser]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setWarehouses(data || []);

      // Seleccionar warehouse BASE por defecto
      const baseWarehouse = data?.find(w => w.code === 'BASE');
      if (baseWarehouse) {
        setActiveWarehouse(baseWarehouse);
      }
    } catch (error) {
      console.error('Error cargando warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  // Si no hay usuario logueado, mostrar login
  if (!currentUser) {
    return <OperatorLogin onLoginSuccess={setCurrentUser} />;
  }

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>🏭 DinoTrack</h1>
          <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
            Operario: {currentUser.name} | Warehouse: {activeWarehouse?.name || 'Seleccionar'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Selector de Warehouse */}
          <select
            value={activeWarehouse?.id || ''}
            onChange={(e) => {
              const warehouse = warehouses.find(w => w.id === e.target.value);
              setActiveWarehouse(warehouse);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '5px',
              border: '1px solid #ddd',
              backgroundColor: 'white'
            }}
          >
            <option value="">Seleccionar Warehouse</option>
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </option>
            ))}
          </select>

          {/* Botón de Logout */}
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🚪 Salir
          </button>
        </div>
      </header>

      {/* Sidebar y Contenido */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 80px)' }}>

        {/* Sidebar */}
        <aside style={{
          width: '250px',
          backgroundColor: 'white',
          padding: '20px',
          borderRight: '1px solid #e0e0e0',
          boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
        }}>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[
                { id: 'dashboard', name: '🏠 Dashboard', icon: '📊' },
                { id: 'components', name: '🧩 Componentes', icon: '📦' },
                { id: 'dinosaurs', name: '🦕 Dinosaurios', icon: '🦖' },
                { id: 'devices', name: '📱 Dispositivos', icon: '🔧' },
                { id: 'inventory', name: '📋 Inventario', icon: '🏪' },
                { id: 'quality', name: '✅ Control de Calidad', icon: '🧪' },
                { id: 'sales', name: '💰 Ventas', icon: '📈' },
                { id: 'shipping', name: '📦 Envíos', icon: '🚚' }
              ].map(page => (
                <li key={page.id} style={{ marginBottom: '5px' }}>
                  <button
                    onClick={() => setCurrentPage(page.id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      backgroundColor: currentPage === page.id ? '#e3f2fd' : 'transparent',
                      border: `2px solid ${currentPage === page.id ? '#2196f3' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {page.icon} {page.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Contenido Principal */}
        <main style={{
          flex: 1,
          padding: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'components' && <Components />}
          {currentPage === 'dinosaurs' && <Dinosaurs />}
          {currentPage === 'devices' && <Devices />}
          {currentPage === 'inventory' && <Inventory />}
          {currentPage === 'quality' && <QualityControl />}
          {currentPage === 'sales' && <Sales />}
          {currentPage === 'shipping' && <Shipping />}
        </main>
      </div>
    </div>
  );
}

// Componentes de Página (simplificados por ahora)
function Dashboard() {
  return (
    <div>
      <h2>🏠 Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>📦 Inventario</h3>
          <p>Total de componentes disponibles</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>🦕 Dinosaurios</h3>
          <p>Productos listos para envío</p>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>📱 Dispositivos</h3>
          <p>ESP32 registrados y listos</p>
        </div>
      </div>
    </div>
  );
}

function Components() {
  return (
    <div>
      <h2>🧩 Gestión de Componentes</h2>
      <p>Registrar y gestionar componentes individuales</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

function Dinosaurs() {
  return (
    <div>
      <h2>🦕 Gestión de Dinosaurios</h2>
      <p>Registrar y rastrear productos terminados</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

function Devices() {
  return (
    <div>
      <h2>📱 Gestión de Dispositivos</h2>
      <p>Registrar módulos ESP32 y realizar pruebas</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

function Inventory() {
  return (
    <div>
      <h2>📋 Gestión de Inventario</h2>
      <p>Control de stock y órdenes de compra</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

function QualityControl() {
  return (
    <div>
      <h2>✅ Control de Calidad</h2>
      <p>Pruebas y validación de productos</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

function Sales() {
  return (
    <div>
      <h2>💰 Gestión de Ventas</h2>
      <p>Seguimiento de ventas y clientes</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

function Shipping() {
  return (
    <div>
      <h2>📦 Gestión de Envíos</h2>
      <p>Preparación y seguimiento de envíos</p>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
        <p>🚧 Funcionalidad en desarrollo...</p>
      </div>
    </div>
  );
}

// Componente Principal
function App() {
  return <DinoTrackApp />;
}

export default App;
