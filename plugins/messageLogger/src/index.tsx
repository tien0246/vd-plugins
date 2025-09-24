import { FluxDispatcher, React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { findByName, findByStoreName } from "@vendetta/metro";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { useProxy } from "@vendetta/storage";
import DeletedMessagesLog from "./DeletedMessagesLog.tsx";

const { TouchableOpacity } = General;

const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

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
        if (storage.deletedMessages[channelId].length === 0) {
            delete storage.deletedMessages[channelId];
        }
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

// The button component that will be injected
function DeletedMessagesButton({ channel }) {
    useProxy(storage); // Re-render when storage changes
    const navigation = NavigationNative.useNavigation();

    const hasDeleted = storage.deletedMessages[channel.id]?.length > 0;
    if (!hasDeleted) return null;

    return (
        <TouchableOpacity
            onPress={() => {
                navigation.push("VendettaCustomPage", {
                    title: `Deleted Msgs in #${channel.name}`,
                    render: () => <DeletedMessagesLog channelId={channel.id} />,
                });
            }}
        >
            <Forms.FormIcon style={{ marginRight: 16 }} source={getAssetIDByName("ic_trash_24px")} />
        </TouchableOpacity>
    );
}

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

        // Patch the component that holds the header buttons
        const ChannelButtons = findByName("ChannelButtons", false);
        if (ChannelButtons) {
            patches.push(after("default", ChannelButtons, ([{ channel }], res) => {
                if (!channel || !Array.isArray(res?.props?.children)) return;
                
                // Add our button to the beginning of the existing buttons
                res.props.children.unshift(<DeletedMessagesButton channel={channel} />);
            }));
        } else {
            logger.error("MessageLogger: Could not find ChannelButtons component");
        }

        logger.log("MessageLogger v1.0.0 loaded.");
    },
    onUnload: () => {
        patches.forEach(p => p?.());
        patches.length = 0;
        logger.log("MessageLogger unloaded.");
    }
};