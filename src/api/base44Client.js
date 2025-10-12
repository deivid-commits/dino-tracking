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

// Component Entity - Full CRUD operations matching base44 SDK
const ComponentEntity = {
  async list(orderBy = '-created_date') {
    try {
      let query = supabase
        .from('components')
        .select('*');

      // Apply ordering based on the parameter
      if (orderBy === '-created_date') {
        query = query.order('created_at', { ascending: false });
      } else if (orderBy === 'name') {
        query = query.order('name');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching components:', error);
      return [];
    }
  },

  async search(query, filters = {}) {
    try {
      let supabaseQuery = supabase
        .from('components')
        .select('*');

      // Apply text search
      if (query) {
        supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,part_number.ilike.%${query}%,description.ilike.%${query}%`);
      }

      // Apply filters
      if (filters.category) {
        supabaseQuery = supabaseQuery.eq('category', filters.category);
      }
      if (filters.tracking_type) {
        supabaseQuery = supabaseQuery.eq('tracking_type', filters.tracking_type);
      }
      if (filters.warehouse_id) {
        supabaseQuery = supabaseQuery.eq('warehouse_id', filters.warehouse_id);
      }

      const { data, error } = await supabaseQuery;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching components:', error);
      return [];
    }
  },

  async create(componentData) {
    try {
      const { data, error } = await supabase
        .from('components')
        .insert([{
          ...componentData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Create batches if provided
      if (componentData.batches) {
        await supabase
          .from('component_batches')
          .insert(componentData.batches.map(batch => ({
            component_id: data.id,
            ...batch,
            created_at: new Date().toISOString()
          })));
      }

      return { ...data, batches: componentData.batches || [] };
    } catch (error) {
      console.error('Error creating component:', error);
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('components')
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
      console.error('Error updating component:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      // First delete related batches
      await supabase
        .from('component_batches')
        .delete()
        .eq('component_id', id);

      // Then delete the component
      const { error } = await supabase
        .from('components')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting component:', error);
      throw error;
    }
  }
};

// Device Entity - Complete device management
const DeviceEntity = {
  async list(orderBy) {
    try {
      let query = supabase
        .from('devices')
        .select('*');

      // Apply ordering
      if (orderBy === '-assembly_date') {
        query = query.order('assembly_date', { ascending: false });
      } else if (orderBy === 'assembly_date') {
        query = query.order('assembly_date');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching devices:', error);
      return [];
    }
  },

  async create(deviceData) {
    try {
      // Get current operator
      const operator = getCurrentOperator();

      const { data, error } = await supabase
        .from('devices')
        .insert([{
          ...deviceData,
          assembly_date: new Date().toISOString(),
          assembled_by_operator: operator,
          status: deviceData.status || 'ready'
        }])
        .select()
        .single();

      if (error) throw error;

      // If components_used exist, update component quantities
      if (deviceData.components_used && deviceData.components_used.length > 0) {
        for (const componentUsed of deviceData.components_used) {
          await ComponentEntity.update(componentUsed.component_id, {
            quantity: componentUsed.quantity - 1 // Simple consumption
          });
        }
      }

      return data;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase
        .from('devices')
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

// Dinosaur Entity
const DinosaurEntity = {
  async list(orderBy = '-created_date') {
    try {
      let query = supabase
        .from('dinosaurs')
        .select('*');

      if (orderBy === '-created_date') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching dinosaurs:', error);
      return [];
    }
  },

  async create(dinosaurData) {
    try {
      const { data, error } = await supabase
        .from('dinosaurs')
        .insert([{
          ...dinosaurData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating dinosaur:', error);
      throw error;
    }
  },

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('dinosaurs')
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
      console.error('Error updating dinosaur:', error);
      throw error;
    }
  }
};

// DinosaurVersion Entity
const DinosaurVersionEntity = {
  async list(orderBy = '-created_date') {
    try {
      let query = supabase
        .from('dinosaur_versions')
        .select('*');

      if (orderBy === '-created_date') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching dinosaur versions:', error);
      return [];
    }
  },

  async create(versionData) {
    try {
      const { data, error } = await supabase
        .from('dinosaur_versions')
        .insert([{
          ...versionData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating dinosaur version:', error);
      throw error;
    }
  }
};

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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
    Component: ComponentEntity,
    Device: DeviceEntity,
    Dinosaur: DinosaurEntity,
    DinosaurVersion: DinosaurVersionEntity,
    PurchaseOrder: PurchaseOrderEntity,
    Sale: SaleEntity,
    Operator: OperatorEntity,
    Warehouse: WarehouseEntity,
    Shipment: ShipmentEntity,
    SlackPOConversation: SlackPOConversationEntity,
    SlackBotLog: SlackBotLogEntity,
    QuickQCLog: QuickQCLogEntity
  },
  auth: AuthEntity
};
