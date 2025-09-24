import { FluxDispatcher } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";

// Cache to hold recent messages. Maps messageId -> { content, author, timerId }
const messageCache = new Map();
// Expire messages from cache after 15 minutes
const CACHE_EXPIRY_MS = 15 * 60 * 1000;

const patches = [];

function cacheMessage(message) {
    // Only cache messages with content from regular users
    if (!message?.id || !message.content || message.author?.bot) return;

    // If a timer already exists for this message (e.g., an edit), clear it to reset the expiry
    if (messageCache.has(message.id)) {
        const existing = messageCache.get(message.id);
        clearTimeout(existing.timer);
    }

    // Set a timer to automatically remove the message from the cache to prevent memory leaks
    const timer = setTimeout(() => {
        messageCache.delete(message.id);
    }, CACHE_EXPIRY_MS);

    messageCache.set(message.id, {
        content: message.content,
        author: message.author?.username ?? "unknown",
        timer: timer,
    });
}

export default {
    onLoad: () => {
        // Listen for new messages to cache them
        patches.push(FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }) => {
            cacheMessage(message);
        }));

        // Listen for updated messages to update the cache
        patches.push(FluxDispatcher.subscribe("MESSAGE_UPDATE", ({ message }) => {
            // The MESSAGE_UPDATE event often has partial data, so we only cache if content is present
            if (message.content) {
                cacheMessage(message);
            }
        }));

        // Listen for deleted messages
        patches.push(FluxDispatcher.subscribe("MESSAGE_DELETE", (action) => {
            if (messageCache.has(action.id)) {
                const cachedMessage = messageCache.get(action.id);
                showToast(`Deleted from ${cachedMessage.author}: ${cachedMessage.content}`);
                
                // Clean up the cache and timer immediately after logging
                clearTimeout(cachedMessage.timer);
                messageCache.delete(action.id);
            }
        }));

        logger.log("MessageLogger loaded with caching strategy.");
    },
    onUnload: () => {
        // Unsubscribe from all events
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches.length = 0;

        // Clear all pending timers and empty the cache to prevent memory leaks
        for (const [_id, cachedMessage] of messageCache) {
            clearTimeout(cachedMessage.timer);
        }
        messageCache.clear();
        
        logger.log("MessageLogger unloaded and cache cleared.");
    }
};