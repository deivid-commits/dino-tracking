import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeWarehouse, setActiveWarehouse] = useState(null);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Cargando warehouses...');

      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw error;
      }

      console.log('✅ Warehouses cargados:', data);
      setWarehouses(data || []);

      // Si hay warehouses, seleccionar el primero como activo
      if (data && data.length > 0) {
        setActiveWarehouse(data[0]);
      }
    } catch (error) {
      console.error('❌ Error cargando warehouses:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createWarehouse = async () => {
    const name = prompt('Nombre del nuevo warehouse:');
    const code = prompt('Código del warehouse:');
    const location = prompt('Ubicación:');

    if (!name || !code) return;

    try {
      const { data, error } = await supabase
        .from('warehouses')
        .insert([{
          name,
          code,
          location,
          description: `Warehouse creado desde la aplicación`,
          is_active: true
        }])
        .select();

      if (error) throw error;

      console.log('✅ Warehouse creado:', data);
      loadWarehouses(); // Recargar la lista
    } catch (error) {
      console.error('❌ Error creando warehouse:', error);
      alert('Error creando warehouse: ' + error.message);
    }
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>🏭 DinoTrack - Supabase Edition</h1>
        <p style={{ margin: '5px 0 0 0', color: '#7f8c8d' }}>
          Gestión de Warehouses con React + Supabase
        </p>
      </header>

      {/* Estado de Conexión */}
      <div style={{
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        backgroundColor: error ? '#ffebee' : '#e8f5e8',
        border: `1px solid ${error ? '#f44336' : '#4caf50'}`,
        color: error ? '#c62828' : '#2e7d32',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: 0 }}>
          {loading ? '🔄 Cargando...' : `✅ ¡Conexión exitosa! Encontrados ${warehouses.length} warehouses`}
        </h2>
        {error && <p style={{ margin: '5px 0 0 0' }}><strong>Error:</strong> {error}</p>}
      </div>

      {/* Contenido Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Lista de Warehouses */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>📦 Warehouses</h2>
            <button
              onClick={createWarehouse}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ➕ Nuevo Warehouse
            </button>
          </div>

          {loading ? (
            <p>Cargando warehouses...</p>
          ) : warehouses.length > 0 ? (
            <div>
              {warehouses.map(warehouse => (
                <div
                  key={warehouse.id}
                  onClick={() => setActiveWarehouse(warehouse)}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    borderRadius: '8px',
                    backgroundColor: activeWarehouse?.id === warehouse.id ? '#e3f2fd' : '#f9f9f9',
                    border: `2px solid ${activeWarehouse?.id === warehouse.id ? '#2196f3' : '#e0e0e0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>{warehouse.name}</h3>
                  <p style={{ margin: '0 0 5px 0', color: '#7f8c8d' }}>
                    <strong>Código:</strong> {warehouse.code}
                  </p>
                  <p style={{ margin: '0 0 5px 0', color: '#7f8c8d' }}>
                    <strong>Ubicación:</strong> {warehouse.location}
                  </p>
                  {warehouse.description && (
                    <p style={{ margin: '0', color: '#7f8c8d', fontSize: '14px' }}>
                      {warehouse.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
              <p>📦 No hay warehouses configurados</p>
              <p>Haz clic en "Nuevo Warehouse" para crear el primero</p>
            </div>
          )}
        </div>

        {/* Detalles del Warehouse Activo */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>
            {activeWarehouse ? '📋 Detalles del Warehouse' : '👈 Selecciona un Warehouse'}
          </h2>

          {activeWarehouse ? (
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Nombre:</label>
                <p style={{ margin: '5px 0', color: '#34495e' }}>{activeWarehouse.name}</p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Código:</label>
                <p style={{ margin: '5px 0', color: '#34495e' }}>{activeWarehouse.code}</p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Ubicación:</label>
                <p style={{ margin: '5px 0', color: '#34495e' }}>{activeWarehouse.location}</p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Estado:</label>
                <p style={{
                  margin: '5px 0',
                  color: activeWarehouse.is_active ? '#27ae60' : '#e74c3c'
                }}>
                  {activeWarehouse.is_active ? '✅ Activo' : '❌ Inactivo'}
                </p>
              </div>

              {activeWarehouse.description && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Descripción:</label>
                  <p style={{ margin: '5px 0', color: '#34495e' }}>{activeWarehouse.description}</p>
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Creado:</label>
                <p style={{ margin: '5px 0', color: '#34495e' }}>
                  {new Date(activeWarehouse.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
              <p>👈 Haz clic en un warehouse para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>

      {/* Información de Debug (Solo en desarrollo) */}
      {import.meta.env.DEV && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>🔧 Información de Debug:</h3>
          <ul style={{ margin: 0, color: '#495057' }}>
            <li>Cliente Supabase: {supabase ? '✅ Inicializado' : '❌ No inicializado'}</li>
            <li>Variables de entorno: {import.meta.env.VITE_SUPABASE_URL ? '✅ Configuradas' : '❌ No configuradas'}</li>
            <li>URL de Supabase: {import.meta.env.VITE_SUPABASE_URL || 'No definida'}</li>
            <li>Modo: {import.meta.env.DEV ? '🛠️ Desarrollo' : '🚀 Producción'}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
