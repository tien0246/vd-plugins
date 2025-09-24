import { FluxDispatcher } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";

// Expire messages from cache after 15 minutes
const CACHE_EXPIRY_MS = 15 * 60 * 1000;

// Initialize storage if it doesn't exist
storage.messageCache ??= {};

const patches = [];

function pruneCache() {
    const now = Date.now();
    let prunedCount = 0;
    for (const id in storage.messageCache) {
        if (now - storage.messageCache[id].timestamp > CACHE_EXPIRY_MS) {
            delete storage.messageCache[id];
            prunedCount++;
        }
    }
    if (prunedCount > 0) {
        logger.log(`MessageLogger: Pruned ${prunedCount} expired messages from cache.`);
    }
}

function cacheMessage(message) {
    // Only cache messages with content from regular users
    if (!message?.id || !message.content || message.author?.bot) return;

    storage.messageCache[message.id] = {
        content: message.content,
        author: message.author?.username ?? "unknown",
        timestamp: Date.now(),
    };
}

export default {
    onLoad: () => {
        // Prune old messages from the cache on load
        pruneCache();

        patches.push(FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }) => {
            cacheMessage(message);
        }));

        patches.push(FluxDispatcher.subscribe("MESSAGE_UPDATE", ({ message }) => {
            // Only update the cache if the message exists and has content
            if (message.content && storage.messageCache[message.id]) {
                cacheMessage(message);
            }
        }));

        patches.push(FluxDispatcher.subscribe("MESSAGE_DELETE", (action) => {
            if (storage.messageCache[action.id]) {
                const cachedMessage = storage.messageCache[action.id];
                showToast(`Deleted from ${cachedMessage.author}: ${cachedMessage.content}`);
                
                delete storage.messageCache[action.id];
            }
        }));

        logger.log("MessageLogger loaded with persistent storage strategy.");
    },
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches.length = 0;
        logger.log("MessageLogger unloaded.");
    }
};