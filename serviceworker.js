const CACHE_KEY = 'storage-testing';
const CACHE_FILES = [
    'index.html',
    'storage.js',
];

class ResourceCache {
    static async populate() {
        const cache = await caches.open(CACHE_KEY);
        await cache.addAll(CACHE_FILES);
    }

    static async update(request, response) {
        const cache = await caches.open(CACHE_KEY);
        await cache.put(request, response);
    }

    static async match(request) {
        const cache = await caches.open(CACHE_KEY);
        const response = await cache.match(request);
        if (response === undefined || response.status === 404) {
            throw 'no-match';
        }
        return response;
    }

    static async fetch(event) {
        // Try fetching the resource from the cache, fall back to network
        let response;
        try {
            // Fetch from cache
            response = await ResourceCache.match(event.request);
        } catch {
            // Fall back to fetch from the network and add it to the cache
            try {
                response = await fetch(event.request);
            } catch (error) {
                console.error('Could not fetch resource from cache or network', error);
                throw error;
            }
            await ResourceCache.update(event.request, response.clone());
            return response;
        }
        
        // Update the cache for a subsequent request asynchronously
        event.waitUntil((async () => {
            try {
                const response = await fetch(event.request);
                await ResourceCache.update(event.request, response);
            } catch (error) {
                console.error('Could not update resource from network', error);
                return;
            }
        })());
        return response;
    }
}

self.addEventListener('install', (event) => {
    // Cache all relevant files
    self.skipWaiting();
    event.waitUntil(ResourceCache.populate());
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
    // Self-explanatory code is self-explanatory, lulz.
    event.waitUntil(self.clients.claim());
    console.log("I have no idea what I'm doing");
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Return the cached resource, if existing
    event.respondWith(ResourceCache.fetch(event));
});

