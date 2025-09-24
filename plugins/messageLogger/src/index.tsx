import { FluxDispatcher, React, ReactNative } from "@vendetta/metro/common";
import { findByProps, findByName, findByStoreName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { after, before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import DeletedMessagesLog from "./DeletedMessagesLog.tsx";

const { TouchableOpacity } = General;
const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");
const Navigation = findByProps("push", "pop");
const ChannelStore = findByStoreName("ChannelStore");

const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

storage.messageCache ??= {};
storage.deletedMessages ??= {}; // { channelId: [messages] }

const patches = [];

function pruneCache() {
    const now = Date.now();
    // Prune live cache
    Object.keys(storage.messageCache).forEach(id => {
        if (now - storage.messageCache[id].timestamp > CACHE_EXPIRY_MS) delete storage.messageCache[id];
    });
    // Prune deleted logs
    Object.keys(storage.deletedMessages).forEach(channelId => {
        storage.deletedMessages[channelId] = storage.deletedMessages[channelId].filter(msg => 
            now - new Date(msg.deletedTimestamp).getTime() < CACHE_EXPIRY_MS
        );
    });
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

        patches.push(FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }) => cacheMessage(message)));

        patches.push(FluxDispatcher.subscribe("MESSAGE_UPDATE", ({ message: updatedMessage }) => {
            const oldCachedMessage = storage.messageCache[updatedMessage.id];
            if (oldCachedMessage && updatedMessage.content && oldCachedMessage.content !== oldCachedMessage.content) {
                const newEditHistory = oldCachedMessage.editHistory ?? [];
                newEditHistory.push({ content: oldCachedMessage.content, timestamp: oldCachedMessage.timestamp });
                storage.messageCache[updatedMessage.id] = { ...oldCachedMessage, content: updatedMessage.content, timestamp: Date.now(), editHistory: newEditHistory };
            }
        }));

        patches.push(FluxDispatcher.subscribe("MESSAGE_DELETE", (action) => {
            const cachedMessage = storage.messageCache[action.id];
            if (cachedMessage) {
                const { channelId } = action;
                storage.deletedMessages[channelId] ??= [];
                storage.deletedMessages[channelId].unshift({ id: action.id, content: cachedMessage.content, author: cachedMessage.author, deletedTimestamp: new Date().toISOString() });
                if (storage.deletedMessages[channelId].length > 100) storage.deletedMessages[channelId].pop();
                delete storage.messageCache[action.id];
            }
        }));

        // Patch Channel Header to add a button
        const ChannelHeader = findByName("ChannelHeader", false);
        if (ChannelHeader) {
            patches.push(after("default", ChannelHeader, (args, res) => {
                const channelId = args[0]?.channelId;
                if (!channelId) return;

                const channel = ChannelStore.getChannel(channelId);
                if (!channel) return;

                const hasDeleted = storage.deletedMessages[channelId]?.length > 0;
                if (!hasDeleted) return;

                const children = res?.props?.children;
                if (!Array.isArray(children)) {
                    showToast("ML Error: Header children not an array");
                    return;
                }

                // Add trash icon button to the end of the header
                children.push(
                    <TouchableOpacity
                        onPress={() => {
                            Navigation.push("VendettaCustomPage", {
                                title: `Deleted Msgs in #${channel.name}`,
                                render: () => <DeletedMessagesLog channelId={channelId} />,
                            });
                        }}
                        style={{ position: 'absolute', right: 12, top: 12 }} // Position it absolutely for now
                    >
                        <Forms.FormIcon source={getAssetIDByName("ic_trash_24px")} />
                    </TouchableOpacity>
                );
            }));
        } else {
            logger.error("MessageLogger: Could not find ChannelHeader component");
        }

        logger.log("MessageLogger loaded with UI.");
    },
    onUnload: () => {
        patches.forEach(p => p?.());
        patches.length = 0;
        logger.log("MessageLogger unloaded.");
    }
};