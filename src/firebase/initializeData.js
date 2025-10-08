/**
 * Initialize Data Script
 * Sets up initial warehouse and base data
 */

import warehouseService from './services/warehouseService.js';

/**
 * Initializes the base data for the application
 * Creates the BASE warehouse and any other initial data needed
 */
export const initializeBaseData = async () => {
  try {
    console.log('🚀 Initializing base data...');

    // Check if BASE warehouse already exists
    const baseWarehouse = await warehouseService.getBaseWarehouse();

    if (!baseWarehouse) {
      console.log('📦 Creating BASE warehouse...');

      const baseWarehouseData = {
        id: 'BASE',
        name: 'Warehouse BASE',
        location: 'Sistema Principal',
        description: 'Warehouse principal que contiene todos los datos históricos y datos maestros',
        is_active: true,
        is_default: true
      };

      await warehouseService.createWarehouse(baseWarehouseData);
      console.log('✅ BASE warehouse created successfully!');
    } else {
      console.log('ℹ️ BASE warehouse already exists');
    }

    // Future: Add other initialization data here as we progress through phases
    // Example: Create system operators, initial components, etc.

    console.log('✨ Base data initialization completed!');
    return true;

  } catch (error) {
    console.error('❌ Error initializing base data:', error);
    throw new Error(`No se pudo inicializar los datos base: ${error.message}`);
  }
};

/**
 * Test function to verify Firebase connectivity
 * Creates a test document and reads it back
 */
export const testFirebaseConnection = async () => {
  try {
    console.log('🧪 Testing Firebase connection...');

    // Create a test warehouse
    const testData = {
      id: 'TEST_WAREHOUSE',
      name: 'Test Warehouse',
      location: 'Test Location',
      description: 'Warehouse de prueba para verificar conectividad',
      is_active: false,
      created_by: 'system'
    };

    console.log('📝 Creating test document...');
    await warehouseService.createWarehouse(testData);

    // Read it back
    console.log('📖 Reading test document...');
    const readData = await warehouseService.getWarehouse('TEST_WAREHOUSE');

    if (readData && readData.name === testData.name) {
      console.log('✅ Firebase connection successful!');

      // Clean up test data
      console.log('🧹 Cleaning up test data...');
      // Note: We'll add delete functionality in phase 2
      // For now, the test document will remain

    } else {
      throw new Error('Test document was not created or retrieved correctly');
    }

    return true;

  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    throw new Error(`No se pudo conectar a Firebase: ${error.message}`);
  }
};

export default { initializeBaseData, testFirebaseConnection };
