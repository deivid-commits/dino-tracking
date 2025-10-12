// Configuración de Supabase - DinoTrack
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Nota: Necesitas configurar estas variables en tu archivo .env:
// VITE_SUPABASE_URL=https://xxxxx.supabase.co
// VITE_SUPABASE_ANON_KEY=xxxxx

// Schema de tablas que necesitas crear en Supabase:
/*
TABLAS NECESARIAS:

-- Entidades principales
1. warehouses (warehouses)
2. components (components) 
3. dinosaurs (dinosaurs)
4. devices (devices)

-- Inventory Management
5. purchase_orders (purchase_orders)
6. purchase_order_items (purchase_order_items)
7. sales (sales)

-- Operators & Auth
8. operators (operators) 

-- Quality & Testing  
9. quick_qc_logs (quick_qc_logs)

-- Slack Integration
10. slack_po_conversations (slack_po_conversations)
11. slack_bot_logs (slack_bot_logs)

-- Shipping
12. shipments (shipments)

-- Audit Trails
13. component_batches (component_batches)
14. dinosaur_versions (dinosaur_versions)

Puedes crear estas tablas automáticamente usando el SQL schema en:
https://github.com/deivid-commits/dino-tracking/blob/main/supabase-schema.sql

O pedir ayuda en los comentarios en GitHub para el script de setup.
*/

console.log('🔥 DinoTrack Supabase Client initialized');
console.log('📍 Supabase URL:', supabaseUrl ? 'configured' : 'needs setup');
console.log('🔑 API Key:', supabaseAnonKey ? 'configured' : 'needs setup');
