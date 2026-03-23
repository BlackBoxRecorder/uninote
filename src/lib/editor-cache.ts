import type { Value } from 'platejs';

const DB_NAME = 'ynote-editor-cache';
const DB_VERSION = 1;
const STORE_NAME = 'content-cache';
const DEFAULT_MAX_SIZE = 50;

export interface CachedContent {
  noteId: string;
  content: Value;
  wordCount: number;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Check if IndexedDB is available (browser environment)
 */
function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Open or create the IndexedDB database
 */
export async function openEditorCacheDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('Failed to open editor cache database:', request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store with noteId as key path
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
        // Create index on timestamp for LRU eviction
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  try {
    return await dbPromise;
  } catch {
    dbPromise = null;
    return null;
  }
}

/**
 * Get cached content for a note
 */
export async function getCachedContent(noteId: string): Promise<CachedContent | null> {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await openEditorCacheDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(noteId);

      request.onerror = () => {
        console.warn('Failed to get cached content:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  } catch (error) {
    console.warn('Error getting cached content:', error);
    return null;
  }
}

/**
 * Set cached content for a note
 */
export async function setCachedContent(
  noteId: string,
  content: Value,
  wordCount: number
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openEditorCacheDB();
    if (!db) return;

    const entry: CachedContent = {
      noteId,
      content,
      wordCount,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => {
        console.warn('Failed to set cached content:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.warn('Error setting cached content:', error);
  }
}

/**
 * Update timestamp for a cached entry (for LRU tracking)
 */
export async function touchCachedContent(noteId: string): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const cached = await getCachedContent(noteId);
    if (cached) {
      cached.timestamp = Date.now();
      await setCachedContent(noteId, cached.content, cached.wordCount);
    }
  } catch (error) {
    console.warn('Error touching cached content:', error);
  }
}

/**
 * Delete cached content for a note
 */
export async function deleteCachedContent(noteId: string): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openEditorCacheDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(noteId);

      request.onerror = () => {
        console.warn('Failed to delete cached content:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.warn('Error deleting cached content:', error);
  }
}

/**
 * Evict oldest entries to keep cache under max size (LRU)
 */
export async function evictOldEntries(maxSize: number = DEFAULT_MAX_SIZE): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openEditorCacheDB();
    if (!db) return;

    // Get all entries sorted by timestamp
    const entries = await new Promise<CachedContent[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });

    // If under limit, no eviction needed
    if (entries.length <= maxSize) return;

    // Sort by timestamp ascending (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Delete oldest entries
    const toDelete = entries.slice(0, entries.length - maxSize);
    
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const entry of toDelete) {
      store.delete(entry.noteId);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('Error evicting old cache entries:', error);
  }
}

/**
 * Clear all cached content
 */
export async function clearAllCache(): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openEditorCacheDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn('Error clearing cache:', error);
  }
}
