import { FluxDispatcher } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";

// Expire messages from cache after 2 days
const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;

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
    if (!message?.id || !message.content || message.author?.bot) return;

    const existingData = storage.messageCache[message.id];

    storage.messageCache[message.id] = {
        content: message.content,
        author: message.author?.username ?? "unknown",
        timestamp: Date.now(),
        // Preserve existing edit history
        editHistory: existingData?.editHistory ?? [],
    };
}

export default {
    onLoad: () => {
        pruneCache();

        patches.push(FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }) => {
            cacheMessage(message);
        }));

        patches.push(FluxDispatcher.subscribe("MESSAGE_UPDATE", ({ message: updatedMessage }) => {
            const oldCachedMessage = storage.messageCache[updatedMessage.id];

            // Check if it's a real edit of a cached message with different content
            if (oldCachedMessage && updatedMessage.content && oldCachedMessage.content !== updatedMessage.content) {
                const newEditHistory = oldCachedMessage.editHistory ?? [];
                newEditHistory.push({
                    content: oldCachedMessage.content,
                    timestamp: oldCachedMessage.timestamp,
                });

                // Update the cache with the new content and the history
                storage.messageCache[updatedMessage.id] = {
                    ...oldCachedMessage,
                    content: updatedMessage.content,
                    timestamp: Date.now(),
                    editHistory: newEditHistory,
                };

                showToast(`Edited: ${oldCachedMessage.content.slice(0, 20)}... -> ${updatedMessage.content.slice(0, 20)}...`);
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