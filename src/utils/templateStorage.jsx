// IndexedDB utility for storing templates per repository
// Templates are stored separately from repository data (not in Git)

const DB_NAME = 'numaflow-templates-db';
const STORE_NAME = 'templates';
const DB_VERSION = 1;

// Initialize IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'repoName' });
            }
        };
    });
}

// Save templates for a repository
export async function saveTemplatesForRepo(repoName, templates) {
    if (!repoName) {
        console.warn('Cannot save templates: no repository name provided');
        return;
    }

    try {
        // Deep clone and serialize to ensure all data is serializable
        // This removes any non-serializable values (functions, etc.)
        const serializedTemplates = JSON.parse(JSON.stringify(templates));

        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            repoName: repoName,
            templates: serializedTemplates,
            updatedAt: new Date().toISOString()
        };

        await new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
    } catch (error) {
        console.error('Error saving templates:', error);
        throw error;
    }
}

// Load templates for a repository
export async function loadTemplatesForRepo(repoName) {
    if (!repoName) {
        return null;
    }

    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const result = await new Promise((resolve, reject) => {
            const request = store.get(repoName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        db.close();
        
        // Return templates if they exist, otherwise null
        // Data is already deserialized from IndexedDB
        return result?.templates || null;
    } catch (error) {
        console.error('Error loading templates:', error);
        return null;
    }
}

// Delete templates for a repository
export async function deleteTemplatesForRepo(repoName) {
    if (!repoName) {
        return;
    }

    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        await new Promise((resolve, reject) => {
            const request = store.delete(repoName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
    } catch (error) {
        console.error('Error deleting templates:', error);
        throw error;
    }
}

// Get all repository names that have templates stored
export async function getAllReposWithTemplates() {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const repos = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result.map(item => item.repoName);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });

        db.close();
        return repos;
    } catch (error) {
        console.error('Error getting repos with templates:', error);
        return [];
    }
}
