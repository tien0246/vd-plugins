import { FluxDispatcher } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";

let unpatch;

export default {
    onLoad: () => {
        showToast("MessageLogger: onLoad called (v2)");
        logger.log("MessageLogger loaded.");
        const MessageStore = findByStoreName("MessageStore");

        if (!MessageStore) {
            showToast("ML Error: Could not find MessageStore!");
            return;
        }

        // Subscribe to the MESSAGE_DELETE action
        unpatch = FluxDispatcher.subscribe("MESSAGE_DELETE", (action) => {
            showToast("ML: MESSAGE_DELETE received!");
            try {
                const message = MessageStore.getMessage(action.channelId, action.id);
                if (message && message.content) {
                    const author = message.author?.username ?? "unknown";
                    showToast(`Deleted from ${author}: ${message.content}`);
                } else {
                    showToast(`ML: Deleted msg [${action.id}] not in cache or has no content.`);
                }
            } catch (e) {
                logger.error("MessageLogger: Error in MESSAGE_DELETE", e);
                showToast(`ML Error: ${e.message}`);
            }
        });
    },
    onUnload: () => {
        unpatch?.();
        logger.log("MessageLogger unloaded.");
    }
}