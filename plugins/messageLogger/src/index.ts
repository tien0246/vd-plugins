import { FluxDispatcher } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";

let unpatch;

export default {
    onLoad: () => {
        logger.log("MessageLogger loaded.");
        const MessageStore = findByStoreName("MessageStore");

        // Subscribe to the MESSAGE_DELETE action
        unpatch = FluxDispatcher.subscribe("MESSAGE_DELETE", (action) => {
            try {
                // This action is dispatched *before* the message is removed from the store
                const message = MessageStore.getMessage(action.channelId, action.id);
                if (message && message.content) {
                    const author = message.author?.username ?? "unknown";
                    showToast(`Deleted from ${author}: ${message.content}`);
                }
            } catch (e) {
                logger.error("MessageLogger: Error in MESSAGE_DELETE", e);
            }
        });
    },
    onUnload: () => {
        unpatch?.();
        logger.log("MessageLogger unloaded.");
    }
}