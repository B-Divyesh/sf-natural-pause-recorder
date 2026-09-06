import type { Take } from './types';

export type StorageScope = 'real' | 'demo';

const DB_NAME = 'pausekeeper';
const STORE = 'takes';
const VERSION = 1;

function dbName(scope: StorageScope): string {
  return scope === 'demo' ? 'demo:pausekeeper' : DB_NAME;
}

function openDb(scope: StorageScope = 'real'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(scope), VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
  });
}

export async function listTakes(scope: StorageScope = 'real'): Promise<Take[]> {
  const db = await openDb(scope);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Take[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveTake(take: Take, scope: StorageScope = 'real'): Promise<void> {
  const db = await openDb(scope);
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(take);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveTakesAtomically(takes: Take[], scope: StorageScope = 'real'): Promise<void> {
  if (!takes.length) return;
  const db = await openDb(scope);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const take of takes) store.put(take);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not import project data.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Project import was rolled back.'));
  });
}

export async function deleteTake(id: string, scope: StorageScope = 'real'): Promise<void> {
  const db = await openDb(scope);
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearTakes(scope: StorageScope): Promise<void> {
  const db = await openDb(scope);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not reset demo data.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not reset demo data.'));
  });
}
