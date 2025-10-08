/**
 * Warehouse Service
 * Maneja la gestión de warehouses (almacenes/ubicaciones)
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../config.js';

/**
 * Referencia a la colección de warehouses
 */
const WAREHOUSES_COLLECTION = 'warehouses';

/**
 * Crea un nuevo warehouse
 * @param {Object} warehouseData - Datos del warehouse
 * @param {string} warehouseData.id - ID único del warehouse (ej: "MAIN_WAREHOUSE")
 * @param {string} warehouseData.name - Nombre del warehouse
 * @param {string} warehouseData.location - Ubicación física
 * @param {boolean} warehouseData.is_active - Si está activo
 * @returns {Promise<Object>} Warehouse creado
 */
export const createWarehouse = async (warehouseData) => {
  try {
    const warehouseDataWithTimestamp = {
      ...warehouseData,
      created_at: new Date()
    };

    const docRef = doc(db, WAREHOUSES_COLLECTION, warehouseData.id);
    await setDoc(docRef, warehouseDataWithTimestamp);

    return {
      ...warehouseData,
      created_at: warehouseDataWithTimestamp.created_at,
      id: warehouseData.id
    };
  } catch (error) {
    console.error('Error creating warehouse:', error);
    throw new Error(`No se pudo crear el warehouse: ${error.message}`);
  }
};

/**
 * Obtiene todos los warehouses
 * @returns {Promise<Array>} Lista de warehouses
 */
export const getAllWarehouses = async () => {
  try {
    const q = query(
      collection(db, WAREHOUSES_COLLECTION),
      orderBy('created_at', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const warehouses = [];

    querySnapshot.forEach((doc) => {
      warehouses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return warehouses;
  } catch (error) {
    console.error('Error getting warehouses:', error);
    throw new Error(`No se pudieron obtener los warehouses: ${error.message}`);
  }
};

/**
 * Obtiene un warehouse específico
 * @param {string} warehouseId - ID del warehouse
 * @returns {Promise<Object|null>} Warehouse encontrado o null
 */
export const getWarehouse = async (warehouseId) => {
  try {
    const docRef = doc(db, WAREHOUSES_COLLECTION, warehouseId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting warehouse:', error);
    throw new Error(`No se pudo obtener el warehouse: ${error.message}`);
  }
};

/**
 * Actualiza un warehouse
 * @param {string} warehouseId - ID del warehouse
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} Warehouse actualizado
 */
export const updateWarehouse = async (warehouseId, updateData) => {
  try {
    const docRef = doc(db, WAREHOUSES_COLLECTION, warehouseId);

    const updateDataWithTimestamp = {
      ...updateData,
      updated_at: new Date()
    };

    await updateDoc(docRef, updateDataWithTimestamp);

    return {
      ...updateData,
      updated_at: updateDataWithTimestamp.updated_at,
      id: warehouseId
    };
  } catch (error) {
    console.error('Error updating warehouse:', error);
    throw new Error(`No se pudo actualizar el warehouse: ${error.message}`);
  }
};

/**
 * Elimina un warehouse
 * @param {string} warehouseId - ID del warehouse a eliminar
 * @returns {Promise<void>}
 */
export const deleteWarehouse = async (warehouseId) => {
  try {
    // Verificar que no sea el warehouse BASE
    if (warehouseId === 'BASE') {
      throw new Error('No se puede eliminar el warehouse BASE');
    }

    const docRef = doc(db, WAREHOUSES_COLLECTION, warehouseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    throw new Error(`No se pudo eliminar el warehouse: ${error.message}`);
  }
};

/**
 * Obtiene el warehouse BASE (datos históricos)
 * @returns {Promise<Object|null>} Warehouse BASE o null
 */
export const getBaseWarehouse = async () => {
  return await getWarehouse('BASE');
};

/**
 * Obtiene solo warehouses activos
 * @returns {Promise<Array>} Lista de warehouses activos
 */
export const getActiveWarehouses = async () => {
  try {
    const q = query(
      collection(db, WAREHOUSES_COLLECTION),
      where('is_active', '==', true),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const warehouses = [];

    querySnapshot.forEach((doc) => {
      warehouses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return warehouses;
  } catch (error) {
    console.error('Error getting active warehouses:', error);
    throw new Error(`No se pudieron obtener los warehouses activos: ${error.message}`);
  }
};

export default {
  createWarehouse,
  getAllWarehouses,
  getWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getBaseWarehouse,
  getActiveWarehouses
};
