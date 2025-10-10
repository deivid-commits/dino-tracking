import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function getWarehouses() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('warehouses')
          .select('*');

        if (error) {
          throw error;
        }

        setWarehouses(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    getWarehouses();
  }, []);

  return (
    <div>
      <h1>DinoTrack - Supabase Edition</h1>
      <h2>Warehouses</h2>
      {loading && <p>Cargando warehouses...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {warehouses.length > 0 ? (
        <ul>
          {warehouses.map(warehouse => (
            <li key={warehouse.id}>
              <strong>{warehouse.name}</strong> ({warehouse.code}) - {warehouse.location}
            </li>
          ))}
        </ul>
      ) : (
        !loading && !error && <p>No se encontraron warehouses. ¿Ejecutaste el script SQL?</p>
      )}
    </div>
  );
}

export default App;
