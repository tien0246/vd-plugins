import { FluxDispatcher, React, ReactNative } from "@vendetta/metro/common";
import { findByProps, findByName, findByStoreName } from "@vendetta/metro";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { showDialog } from "../../../lib/ui/AlertDialog.tsx";

const { TouchableOpacity, View } = General;
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

// A dedicated component for the button to use hooks safely
function TrashButton({ channelId, channelName }) {
    return (
        <TouchableOpacity
            onPress={() => {
                const deletedMessages = storage.deletedMessages?.[channelId] ?? [];
                const logContent = deletedMessages
                    .slice(0, 10) // Show top 10
                    .map(msg => `[${new Date(msg.deletedTimestamp).toLocaleTimeString()}] ${msg.author}: ${msg.content}`)
                    .join('\n\n');

                showDialog({
                    title: `Deleted Msgs in #${channelName}`,
                    content: logContent || "No deleted messages logged.",
                    confirmText: "Close",
                });
            }}
            style={{ position: 'absolute', right: 50, top: 13, zIndex: 1 }}
        >
            <Forms.FormIcon source={getAssetIDByName("ic_trash_24px")} />
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

        const ChannelHeader = findByName("ChannelHeader", false);
        if (ChannelHeader) {
            patches.push(instead("default", ChannelHeader, (args, orig) => {
                const originalHeader = orig(...args);
                const channelId = args[0]?.channelId;
                if (!channelId) return originalHeader;

                const channel = ChannelStore.getChannel(channelId);
                if (!channel) return originalHeader;

                const hasDeleted = storage.deletedMessages[channelId]?.length > 0;
                if (!hasDeleted) return originalHeader;

                return (
                    <View style={{ flex: 1 }}>
                        {originalHeader}
                        <TrashButton channelId={channelId} channelName={channel.name} />
                    </View>
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
