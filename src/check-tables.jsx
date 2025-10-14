// Component temporal para verificar tablas
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tsazpplddhrxpwnszrrt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzYXpwcGxkZGhyeHB3bnN6cnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjM3NTMsImV4cCI6MjA3NTU5OTc1M30.D4jGctOp43ejJnIUQHyYvMhb6TwCw5reinXf9iVD7RY";

function TableChecker() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkTables();
  }, []);

  const checkTables = async () => {
    setLoading(true);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const expectedTables = [
      'BOM_VERSIONS',
      'PURCHASE_ORDERS',
      'PURCHASE_ORDER_ITEMS',
      'TOYS',
      'DEVICE_COMPONENTS',
      'WAREHOUSES'
    ];

    const tableResults = [];

    for (const table of expectedTables) {
      try {
        const { data, error } = await supabase
          .from(table.toLowerCase())
          .select('*')
          .limit(1);

        if (error && error.message.includes('does not exist')) {
          tableResults.push({
            table,
            status: 'NO EXISTE',
            error: error.message,
            data: null
          });
        } else {
          tableResults.push({
            table,
            status: 'EXISTE',
            error: null,
            data: data || [],
            recordCount: data ? data.length : 0
          });
        }
      } catch (err) {
        tableResults.push({
          table,
          status: 'ERROR',
          error: err.message,
          data: null
        });
      }
    }

    setResults(tableResults);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-4">🔍 Verificando tablas en Supabase...</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📊 Verificación de Tablas en Supabase</h1>

      <div className="space-y-4">
        {results.map((result) => (
          <div key={result.table} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              {result.status === 'EXISTE' ? (
                <span className="text-green-600 font-semibold">✅ {result.table}</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ {result.table}</span>
              )}
              <span className="text-sm text-gray-600">({result.status})</span>
            </div>

            {result.error && (
              <div className="text-red-500 text-sm mb-2">
                Error: {result.error}
              </div>
            )}

            {result.data !== null && (
              <div className="text-green-600 text-sm">
                ✅ Tabla existe - Registros encontrados: {result.recordCount}
                {result.data.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Ver ejemplo</summary>
                    <pre className="text-xs bg-gray-100 p-2 mt-2 rounded overflow-auto">
                      {JSON.stringify(result.data[0], null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={checkTables}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        🔄 Re-verificar
      </button>
    </div>
  );
}

export default TableChecker;
