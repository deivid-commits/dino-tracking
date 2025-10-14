// Script temporal para verificar tablas en Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tsazpplddhrxpwnszrrt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzYXpwcGxkZGhyeHB3bnN6cnJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjM3NTMsImV4cCI6MjA3NTU5OTc1M30.D4jGctOp43ejJnIUQHyYvMhb6TwCw5reinXf9iVD7RY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('🔍 Verificando tablas en Supabase...');

  try {
    // Lista de tablas esperadas según el schema REAL
    const expectedTables = [
      'BOM_VERSIONS',
      'PURCHASE_ORDERS',
      'PURCHASE_ORDER_ITEMS',
      'TOYS',
      'DEVICE_COMPONENTS',
      'WAREHOUSES' // Esta ya existía
    ];

    console.log('📋 Tablas esperadas del schema REAL:', expectedTables);

    // Intentar hacer una query simple en cada tabla para verificar existencia
    for (const table of expectedTables) {
      try {
        const { data, error } = await supabase
          .from(table.toLowerCase())
          .select('*')
          .limit(1);

        if (error && error.message.includes('does not exist')) {
          console.log(`❌ Tabla ${table}: NO EXISTE`);
        } else {
          console.log(`✅ Tabla ${table}: EXISTE`);

          // Si existe, mostrar un registro de ejemplo
          if (data && data.length > 0) {
            console.log(`   📄 Ejemplo:`, JSON.stringify(data[0], null, 2));
          } else {
            console.log(`   📄 Sin registros aún`);
          }
        }
      } catch (err) {
        console.log(`❌ Error verificando tabla ${table}:`, err.message);
      }
    }

    console.log('\n🎯 Verificación completa');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar solo si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  checkTables();
}

export { checkTables };
