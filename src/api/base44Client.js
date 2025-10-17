import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../supabaseClient';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to get current operator from localStorage
const getCurrentOperator = () => {
  try {
    const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
    return operator.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
};

// Get current language
const getCurrentLanguage = () => {
  return localStorage.getItem('dinotrack-language') || 'es';
};

/* Detect toy_components column names dynamically (cached) */
let __bomColumnsCache = null;
async function __getBomColumns() {
  if (__bomColumnsCache) return __bomColumnsCache;
  try {
    const { data } = await supabase.from('toy_components').select('*').limit(1);
    const keys = Array.isArray(data) && data[0] ? Object.keys(data[0]) : [];
    const skuCandidates = ['component_sku', 'sku', 'code', 'name'];
    const descCandidates = ['component_description', 'description', 'desc'];
    const skuKey = skuCandidates.find(k => keys.includes(k)) || null;
    const descKey = descCandidates.find(k => keys.includes(k)) || null;
    __bomColumnsCache = { skuKey, descKey };
    return __bomColumnsCache;
  } catch (e) {
    console.warn('Could not detect toy_components columns. Will use fallbacks.', e);
    __bomColumnsCache = { skuKey: null, descKey: null };
    return __bomColumnsCache;
  }
};

/* 🔥 COMPONENTS CATALOG - Simple SKU catalog for BOM versions
   Components are just SKU + optional Description, stored in toy_components.
   BOM recipe now lives inside bom_versions.bom_recipe (JSONB). */
const ComponentInventoryEntity = {
  async list(orderBy = 'component_sku') {
    try {
      const { data, error } = await supabase
        .from('toy_components')
        .select('*');

      if (error) throw error;

      // Normalize to ensure UI gets the expected fields regardless of column names
      const normalized = (data || []).map(row => ({
        ...row,
        component_sku: row.component_sku || row.sku || row.SKU || row.code,
        component_description: row.component_description || row.description || row.desc || ''
      }));

      // Sort client-side to avoid DB errors when column doesn't exist
      if (orderBy === 'component_sku') {
        normalized.sort((a, b) => (a.component_sku || '').localeCompare(b.component_sku || ''));
      }

      return normalized;
    } catch (error) {
      console.error('Error fetching components:', error);
      return [];
    }
  },

  async getBySKU(sku) {
    try {
      // Try component_sku first
      let { data, error } = await supabase
        .from('toy_components')
        .select('*')
        .eq('component_sku', sku)
        .limit(1);

      if ((error && error.code === '42703') || !data || data.length === 0) {
        // Fallback to sku column
        const res = await supabase
          .from('toy_components')
          .select('*')
          .eq('sku', sku)
          .limit(1);
        data = res.data;
        error = res.error;
      }

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const row = data[0];
      return {
        ...row,
        component_sku: row.component_sku || row.sku,
        component_description: row.component_description || row.description
      };
    } catch (error) {
      console.error('Error fetching component by SKU:', error);
      return null;
    }
  },

  // Get all unique SKUs
  async getUniqueSKUs() {
    try {
      const items = await this.list('component_sku');
      return [...new Set(items.map(i => i.component_sku).filter(Boolean))];
    } catch (error) {
      console.error('Error fetching unique SKUs:', error);
      return [];
    }
  },

  // 🔥 Create a new component (just SKU + description)
  async create(componentData) {
    // Prefer detected column names when possible
    const { skuKey, descKey } = await __getBomColumns();
    const preferred = (skuKey && descKey)
      ? [{ [skuKey]: componentData.component_sku, [descKey]: componentData.component_description }]
      : [];

    // Try multiple possible column mappings to be resilient to schema differences
    const base = { component_sku: componentData.component_sku };
    const hasDesc = !!(componentData.component_description && String(componentData.component_description).trim());
    const candidates = [
      ...preferred,
      // Canonical schema (our migration): component_sku + description (optional)
      hasDesc ? { ...base, description: componentData.component_description } : base,
      // Fallback if some env used component_description instead of description
      hasDesc ? { ...base, component_description: componentData.component_description } : base
      // Note: We intentionally avoid alias columns (sku/code/name) to prevent schema cache errors
    ];

    let lastError = null;

    // First pass: insert + select single (preferred)
    for (const payload of candidates) {
      const { data, error } = await supabase
        .from('toy_components')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        return {
          ...data,
          component_sku: data.component_sku || data.sku || data.code || data.name,
          component_description: data.component_description || data.description || data.desc || ''
        };
      }
      lastError = error;
    }

    // Second pass: insert without select, then fetch
    for (const payload of candidates) {
      const { error } = await supabase
        .from('toy_components')
        .insert([payload]);

      if (!error) {
        // Try to fetch back the record by SKU using our normalized getter
        const fetched = await ComponentInventoryEntity.getBySKU(componentData.component_sku);
        if (fetched) return fetched;
        // As a final fallback, return normalized input
        return {
          component_sku: componentData.component_sku,
          component_description: componentData.component_description
        };
      }
      lastError = error;
    }

    // If all attempts failed, throw the last supabase error for visibility
    console.error('Error creating component:', lastError);
    throw lastError || new Error('Failed to insert into toy_components');
  },

  // Update component description
  async update(sku, updates) {
    try {
      // Intento A: actualizar component_description filtrando por component_sku
      const updateA = {};
      if (Object.prototype.hasOwnProperty.call(updates, 'component_description')) {
        updateA.component_description = updates.component_description;
      }

      let { data, error } = await supabase
          .from('toy_components')
        .update(updateA)
        .eq('component_sku', sku)
        .select()
        .single();

      // Intento B: si no existe component_description, usar description filtrando por component_sku
      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        const updateB = {};
        if (Object.prototype.hasOwnProperty.call(updates, 'component_description')) {
          updateB.description = updates.component_description;
        }
        const resB = await supabase
        .from('toy_components')
          .update(updateB)
          .eq('component_sku', sku)
          .select()
          .single();
        data = resB.data;
        error = resB.error;
      }

      // Intento C: fallback final, usar description filtrando por sku
      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        const updateC = {};
        if (Object.prototype.hasOwnProperty.call(updates, 'component_description')) {
          updateC.description = updates.component_description;
        }
        const resC = await supabase
          .from('toy_components')
          .update(updateC)
          .eq('sku', sku)
          .select()
          .single();
        data = resC.data;
        error = resC.error;
      }

      if (error) throw error;
      return data && {
        ...data,
        component_sku: data.component_sku || data.sku,
        component_description: data.component_description || data.description
      };
    } catch (error) {
      console.error('Error updating component:', error);
      throw error;
    }
  },

  // Delete component
  async delete(sku) {
    try {
      let { error } = await supabase
        .from('toy_components')
        .delete()
        .eq('component_sku', sku);

      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        const res = await supabase
          .from('toy_components')
          .delete()
          .eq('sku', sku);
        error = res.error;
      }

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting component:', error);
      throw error;
    }
  }
};

// Legacy PURCHASE_ORDER_ITEMS Entity - Direct access to PO items
const PurchaseOrderItemEntity = {
  async list(orderBy = 'po_number') {
    try {
      let query = supabase
        .from('purchase_order_items')
        .select(`
          *,
          purchase_orders!inner(po_number, supplier_name)
        `);

      // Apply ordering based on the parameter
      if (orderBy === 'po_number') {
        query = query.order('po_number');
      } else if (orderBy === '-created_at') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching purchase order items:', error);
      return [];
    }
  },

  async search(query, filters = {}) {
    try {
      let supabaseQuery = supabase
        .from('purchase_order_items')
        .select(`
          *,
          purchase_orders!inner(po_number, supplier_name)
        `);

      // Apply text search
      if (query) {
        supabaseQuery = supabaseQuery.or(`component_sku.ilike.%${query}%,component_description.ilike.%${query}%`);
      }

      // Apply filters - adapt to schema
      if (filters.po_number) {
        supabaseQuery = supabaseQuery.eq('po_number', filters.po_number);
      }

      const { data, error } = await supabaseQuery;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching purchase order items:', error);
      return [];
    }
  },

  async create(poItemData) {
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .insert([{
          ...poItemData,
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          purchase_orders(po_number, supplier_name)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating purchase order item:', error);
      throw error;
    }
  },

  async update(poItemId, updates) {
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .update(updates)
        .eq('po_item_id', poItemId)
        .select(`
          *,
          purchase_orders(po_number, supplier_name)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating purchase order item:', error);
      throw error;
    }
  },

  async delete(poItemId) {
    try {
      const { error } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('po_item_id', poItemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting purchase order item:', error);
      throw error;
    }
  }
};

// Device Entity - Maps to voice_box_assembly table
const DeviceEntity = {
  async list(orderBy) {
    try {
      // First try without JOIN to see if the table exists and works
      let query = supabase
        .from('voice_box_assembly')
        .select('*');

      // Apply ordering
      if (orderBy === '-assembly_date') {
        query = query.order('assembly_date', { ascending: false });
      } else if (orderBy === 'assembly_date') {
        query = query.order('assembly_date');
      }

      const { data, error } = await query;
      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      console.log('📋 Raw device data from DB (no JOIN):', data);

      // Transform data to match expected device format
      const transformedData = (data || []).map(item => ({
        id: item.id,
        device_id: item.test_results?.device_id || item.id, // Get device_id from test_results JSON
        mac_address: item.mac_address || '', // Now stores the actual MAC address as text
        version_id: item.bom_version_id,
        warehouse_id: item.warehouse_id || null, // Get warehouse_id from table column (null if not set)
        status: item.final_qc_status || 'ready',
        assembly_date: item.assembly_date,
        assembled_by_operator: item.assembled_by,
        notes: item.test_results?.notes || '',
        components_used: [], // Not directly available, would need separate query
        // Additional fields from voice_box_assembly
        toy_id: item.toy_id,
        qc_result: item.qc_result,
        firmware_version: item.firmware_version,
        calibration_passed: item.calibration_passed,
        // Version info - will be populated separately if needed
        version_name: null,
        model_name: null
      }));

      console.log('📋 Transformed device data:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('❌ Error fetching devices:', error);
      console.error('❌ Error details:', error.message, error.details, error.hint);
      return [];
    }
  },

  async create(deviceData) {
    try {
      // Get current operator
      const operator = getCurrentOperator();

      // Create assembly record directly - toy_id is now nullable
      const { data, error } = await supabase
        .from('voice_box_assembly')
        .insert([{
          toy_id: null, // No toy relationship - devices exist independently
          bom_version_id: deviceData.version_id,
          warehouse_id: deviceData.warehouse_id, // Store warehouse_id directly in the table
          assembly_date: new Date().toISOString(),
          assembled_by: operator,
          final_qc_status: deviceData.status || 'ready',
          mac_address: deviceData.mac_address || null, // Store the actual MAC address as text
          test_results: {
            device_id: deviceData.device_id,
            notes: deviceData.notes || '',
            mac_address: deviceData.mac_address,
            created_by: operator,
            created_at: new Date().toISOString()
          }
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Device created successfully:', data);

      // Transform response to match expected format
      return {
        id: data.id,
        device_id: data.test_results.device_id, // Get from test_results
        mac_address: data.mac_address || '', // Return the actual MAC address
        version_id: data.bom_version_id,
        warehouse_id: data.warehouse_id || 'default', // Get warehouse from table column
        status: data.final_qc_status || 'ready',
        assembly_date: data.assembly_date,
        assembled_by_operator: data.assembled_by,
        notes: data.test_results.notes || '',
        components_used: [],
        toy_id: null, // No toy relationship
        qc_result: data.qc_result,
        firmware_version: data.firmware_version,
        calibration_passed: data.calibration_passed
      };
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase
        .from('voice_box_assembly')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  }
};

// TOYS Entity - Replaces Dinosaur entity for schema REAL compatibility
const ToysEntity = {
  async list(orderBy = '-created_at') {
    try {
      let query = supabase
        .from('toys')
        .select('*');

      if (orderBy === '-created_at') {
        query = query.order('created_at', { ascending: false });
      } else if (orderBy === 'serial_number') {
        query = query.order('serial_number');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching toys:', error);
      return [];
    }
  },

  async search(query, filters = {}) {
    try {
      let supabaseQuery = supabase
        .from('toys')
        .select('*');

      // Apply text search
      if (query) {
        supabaseQuery = supabaseQuery.or(`serial_number.ilike.%${query}%,voice_box_id.ilike.%${query}%,sku.ilike.%${query}%`);
      }

      // Apply status filter
      if (filters.manufacturing_status) {
        supabaseQuery = supabaseQuery.eq('manufacturing_status', filters.manufacturing_status);
      }

      const { data, error } = await supabaseQuery;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching toys:', error);
      return [];
    }
  },

  async create(toyData) {
    try {
      const { data, error } = await supabase
        .from('toys')
        .insert([{
          ...toyData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating toy:', error);
      throw error;
    }
  },

  async update(serialNumber, updates) {
    // Updates by serial_number since that's the primary key in TOYS
    try {
      const { data, error } = await supabase
        .from('toys')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('serial_number', serialNumber)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating toy:', error);
      throw error;
    }
  },

  async delete(serialNumber) {
    try {
      const { error } = await supabase
        .from('toys')
        .delete()
        .eq('serial_number', serialNumber);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting toy:', error);
      throw error;
    }
  }
};

// Dinosaur Entity - Legacy compatibility (maps to TOYS but keeps old interface)
const DinosaurEntity = ToysEntity;

// BOM_VERSIONS Entity - Replaces DinosaurVersion for schema REAL compatibility
const BomVersionsEntity = {
  async list(orderBy = '-created_at') {
    try {
      let query = supabase
        .from('bom_versions')
        .select('*');

      if (orderBy === '-created_at') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching BOM versions:', error);
      return [];
    }
  },

  async create(versionData) {
    try {
      // Remove bom_recipe from the main payload and handle it separately
      const { bom_recipe, ...mainData } = versionData;

      const { data, error } = await supabase
        .from('bom_versions')
        .insert([mainData])
        .select()
        .single();

      if (error) throw error;

      // If bom_recipe was provided, update it separately
      if (bom_recipe) {
        await supabase
          .from('bom_versions')
          .update({ bom_recipe })
          .eq('id', data.id);
      }

      return data;
    } catch (error) {
      console.error('Error creating BOM version:', error);
      throw error;
    }
  },

  async update(bomVersionId, updates) {
    try {
      // Handle bom_recipe separately to avoid column selection issues
      const { bom_recipe, ...otherUpdates } = updates;

      let updateData = otherUpdates;

      const { data, error } = await supabase
        .from('bom_versions')
        .update(updateData)
        .eq('id', bomVersionId) // Use 'id' not 'bom_version_id'
        .select()
        .single();

      if (error) throw error;

      // If bom_recipe was provided, update it separately
      if (bom_recipe !== undefined) {
        await supabase
          .from('bom_versions')
          .update({ bom_recipe })
          .eq('id', bomVersionId);
      }

      return data;
    } catch (error) {
      console.error('Error updating BOM version:', error);
      throw error;
    }
  },

  async delete(bomVersionId) {
    try {
      const { error } = await supabase
        .from('bom_versions')
        .delete()
        .eq('id', bomVersionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting BOM version:', error);
      throw error;
    }
  }
};

// LEGACY: DinosaurVersion maps to BomVersions for API compatibility
const DinosaurVersionEntity = BomVersionsEntity;

// PurchaseOrder Entity
const PurchaseOrderEntity = {
  async list(orderBy = '-order_date') {
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*');

      if (orderBy === '-order_date') {
        query = query.order('order_date', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      return [];
    }
  },

  async create(poData) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([{
          ...poData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Create items if provided
      if (poData.items) {
        await supabase
          .from('purchase_order_items')
          .insert(poData.items.map(item => ({
            purchase_order_id: data.id,
            ...item
          })));
      }

      return data;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating purchase order:', error);
      throw error;
    }
  }
};

// Sale Entity
const SaleEntity = {
  async list(orderBy = '-created_date') {
    try {
      let query = supabase
        .from('sales')
        .select('*');

      if (orderBy === '-created_date') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sales:', error);
      return [];
    }
  },

  async create(saleData) {
    try {
      const { data, error } = await supabase
        .from('sales')
        .insert([{
          ...saleData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  }
};

// Operator Entity
const OperatorEntity = {
  async list() {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching operators:', error);
      return [];
    }
  },

  async create(operatorData) {
    try {
      const { data, error } = await supabase
        .from('operators')
        .insert([{
          ...operatorData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating operator:', error);
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('operators')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating operator:', error);
      throw error;
    }
  }
};

// Warehouse Entity
const WarehouseEntity = {
  async list(orderBy = 'name') {
    try {
      let query = supabase
        .from('warehouses')
        .select('*');

      if (orderBy === 'name') {
        query = query.order('name');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      return [];
    }
  },

  async create(warehouseData) {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .insert([{
          ...warehouseData,
          operators: warehouseData.operators || [], // Operadores embebidos como JSON
          created_at: new Date().toISOString()  // Solo created_at según schema
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating warehouse:', error);
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .update(updates)  // Solo campos a actualizar, sin updated_at
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating warehouse:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      throw error;
    }
  }
};

// Other entities - Quick implementations for completeness
const ShipmentEntity = {
  async list() {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  },

  async create(shipmentData) {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .insert([{
          ...shipmentData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
};

// Slack Entities
const SlackPOConversationEntity = {
  async list() {
    try {
      const { data, error } = await supabase
        .from('slack_po_conversations')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }
};

const SlackBotLogEntity = {
  async list() {
    try {
      const { data, error } = await supabase
        .from('slack_bot_logs')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }
};

// QC Entity
const QuickQCLogEntity = {
  async list(orderBy = '-created_date') {
    try {
      let query = supabase
        .from('quick_qc_logs')
        .select('*');

      if (orderBy === '-created_date') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QC logs:', error);
      return [];
    }
  },

  async create(qcData) {
    try {
      const { data, error } = await supabase
        .from('quick_qc_logs')
        .insert([{
          ...qcData,
          created_at: new Date().toISOString(),
          test_date: qcData.test_date || new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating QC log:', error);
      throw error;
    }
  }
};

// Auth SDK replacement
const AuthEntity = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }
};

// Export the base44 compatible object
export const base44 = {
  entities: {
    Component: ComponentInventoryEntity, // 🔥 COMPONENT INVENTORY VIEW - Aggregated by SKU
    ComponentItem: PurchaseOrderItemEntity, // Legacy PO items direct access
    Device: DeviceEntity,
    Dinosaur: DinosaurEntity, // LEGACY: Maps to TOYS
    DinosaurVersion: BomVersionsEntity, // LEGACY: Maps to BOM_VERSIONS
    BomVersion: BomVersionsEntity, // NEW: Direct access
    PurchaseOrder: PurchaseOrderEntity,
    PurchaseOrderItem: PurchaseOrderItemEntity, // NEW: Direct access
    Sale: SaleEntity,
    Toy: ToysEntity, // NEW: Direct access to TOYS table
    Operator: OperatorEntity,
    Warehouse: WarehouseEntity,
    Shipment: ShipmentEntity,
    SlackPOConversation: SlackPOConversationEntity,
    SlackBotLog: SlackBotLogEntity,
    QuickQCLog: QuickQCLogEntity
  },
  auth: AuthEntity
};
