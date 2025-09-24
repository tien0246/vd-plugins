import { FluxDispatcher } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { before } from "@vendetta/patcher";

let unpatch;

export default {
    onLoad: () => {
        showToast("MessageLogger: onLoad called (v4)");
        const MessageStore = findByStoreName("MessageStore");

        if (!MessageStore) {
            showToast("ML Error: Could not find MessageStore!");
            return;
        }

        unpatch = before("dispatch", FluxDispatcher, (args) => {
            const action = args[0];
            if (action.type !== "MESSAGE_DELETE") return;

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
};