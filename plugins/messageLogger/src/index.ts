import { FluxDispatcher, React } from "@vendetta/metro/common";
import { findByProps, findByName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { after, before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

// Expire messages from cache after 2 days
const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;

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

            if (oldCachedMessage && updatedMessage.content && oldCachedMessage.content !== oldCachedMessage.content) {
                const newEditHistory = oldCachedMessage.editHistory ?? [];
                newEditHistory.push({
                    content: oldCachedMessage.content,
                    timestamp: oldCachedMessage.timestamp,
                });

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

        // Patch context menu
        patches.push(before("openLazy", ActionSheet, (args) => {
            const [component, action, messageProps] = args;
            if (action !== "MessageLongPressActionSheet") return;

            const messageId = messageProps?.message?.id;
            if (!messageId) return;

            const cachedMessage = storage.messageCache[messageId];
            const hasHistory = cachedMessage?.editHistory?.length > 0;

            if (!hasHistory) return;

            component.then(instance => {
                const unpatch = after("default", instance, (_, res) => {
                    React.useEffect(() => () => { unpatch() }, []);
                    
                    const buttons = findInReactTree(res, r => r?.find?.(c => c?.props?.label === "Copy Text"));
                    if (!buttons) return;

                    buttons.push(
                        <ActionSheetRow
                            label="View Edit History"
                            icon={<ActionSheetRow.Icon source={getAssetIDByName("ic_audit_log_24px")} />}
                            onPress={() => {
                                showToast(`This message has ${cachedMessage.editHistory.length} previous version(s).`);
                                ActionSheet.hideActionSheet();
                            }}
                        />
                    );
                });
            });
        }));

        logger.log("MessageLogger loaded with persistent storage and context menu patch.");
    },
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches.length = 0;
        logger.log("MessageLogger unloaded.");
    }
};