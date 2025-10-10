import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [status, setStatus] = useState('Cargando...');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function testConnection() {
      try {
        console.log('🔍 Probando conexión a Supabase...');

        // Primero, verificar que el cliente se inicializó correctamente
        if (!supabase) {
          throw new Error('Cliente de Supabase no inicializado');
        }

        console.log('✅ Cliente de Supabase inicializado');

        // Intentar una consulta simple
        const { data, error } = await supabase
          .from('warehouses')
          .select('id')
          .limit(1);

        if (error) {
          console.error('❌ Error de Supabase:', error);
          setError(`Error de Supabase: ${error.message}`);
          setStatus('Error de conexión');
        } else {
          console.log('✅ Consulta exitosa:', data);
          setStatus(`¡Conexión exitosa! Encontrados ${data?.length || 0} warehouses`);
        }
      } catch (error) {
        console.error('❌ Error general:', error);
        setError(error.message);
        setStatus('Error general');
      }
    }

    testConnection();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>DinoTrack - Supabase Edition</h1>
      <div style={{
        padding: '15px',
        margin: '20px 0',
        borderRadius: '8px',
        backgroundColor: error ? '#ffebee' : '#e8f5e8',
        border: `1px solid ${error ? '#f44336' : '#4caf50'}`,
        color: error ? '#c62828' : '#2e7d32'
      }}>
        <h2>Estado: {status}</h2>
        {error && <p><strong>Error:</strong> {error}</p>}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>🔧 Información de Debug:</h3>
        <ul>
          <li>Cliente Supabase: {supabase ? '✅ Inicializado' : '❌ No inicializado'}</li>
          <li>Variables de entorno: {import.meta.env.VITE_SUPABASE_URL ? '✅ Configuradas' : '❌ No configuradas'}</li>
          <li>URL de Supabase: {import.meta.env.VITE_SUPABASE_URL || 'No definida'}</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
