import { FluxDispatcher, React, ReactNative, clipboard } from "@vendetta/metro/common";
import { findByProps, findByName, findByStoreName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { after, before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import DeletedMessagesLog from "./DeletedMessagesLog.tsx";

const { TouchableOpacity } = General;
const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");
const Navigation = findByProps("push", "pop");
const ChannelStore = findByStoreName("ChannelStore");

const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;

storage.messageCache ??= {};
storage.deletedMessages ??= {};

const patches = [];

function pruneCache() {
    const now = Date.now();
    Object.keys(storage.messageCache).forEach(id => {
        if (now - storage.messageCache[id].timestamp > CACHE_EXPIRY_MS) delete storage.messageCache[id];
    });
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

let hasShownAlert = false;

export default {
    onLoad: () => {
        pruneCache();

        patches.push(FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }) => cacheMessage(message)));
        patches.push(FluxDispatcher.subscribe("MESSAGE_UPDATE", ({ message: u }) => {
            const old = storage.messageCache[u.id];
            if (old && u.content && old.content !== u.content) {
                const history = old.editHistory ?? [];
                history.push({ content: old.content, timestamp: old.timestamp });
                storage.messageCache[u.id] = { ...old, content: u.content, timestamp: Date.now(), editHistory: history };
            }
        }));
        patches.push(FluxDispatcher.subscribe("MESSAGE_DELETE", (a) => {
            const m = storage.messageCache[a.id];
            if (m) {
                storage.deletedMessages[a.channelId]??=[];
                storage.deletedMessages[a.channelId].unshift({id:a.id,content:m.content,author:m.author,deletedTimestamp:new Date().toISOString()});
                if(storage.deletedMessages[a.channelId].length>100)storage.deletedMessages[a.channelId].pop();
                delete storage.messageCache[a.id];
            }
        }));

        // Patch Channel Header to log its children's prop keys
        const ChannelHeader = findByName("ChannelHeader", false);
        if (ChannelHeader) {
            patches.push(after("default", ChannelHeader, (args, res) => {
                const channelId = args[0]?.channelId;
                if (!channelId || hasShownAlert) return;

                const hasDeleted = storage.deletedMessages[channelId]?.length > 0;
                if (!hasDeleted) return;

                hasShownAlert = true; // Show the alert only once per session
                
                const children = res?.props?.children;
                if (!children) {
                    showToast("No children found in ChannelHeader");
                    return;
                }

                const childrenArray = Array.isArray(children) ? children : [children];
                const propsSet = new Set();

                for (const child of childrenArray) {
                    if (child?.props) {
                        const keys = Object.keys(child.props);
                        if (keys.length > 0) {
                            propsSet.add(`[${keys.join(', ')}]`);
                        }
                    }
                }

                const propsString = Array.from(propsSet).join('\n');

                showConfirmationAlert({
                    title: "Second Level Prop Keys",
                    content: propsString || "No 2nd-level components with props found.",
                    confirmText: "Copy",
                    onConfirm: () => {
                        clipboard.setString(propsString);
                        showToast("Copied to clipboard.");
                    },
                    cancelText: "Close",
                });
            }));
        } else {
            logger.error("MessageLogger: Could not find ChannelHeader component");
        }

        logger.log("MessageLogger loaded for debugging component tree.");
    },
    onUnload: () => {
        patches.forEach(p => p?.());
        patches.length = 0;
        hasShownAlert = false;
        logger.log("MessageLogger unloaded.");
    }
};