import { FluxDispatcher, React, ReactNative, NavigationNative, stylesheet } from "@vendetta/metro/common";
import { findByProps, findByName, findByStoreName } from "@vendetta/metro";
import { logger } from "@vendetta";
import { storage } from "@vendetta/plugin";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms, General } from "@vendetta/ui/components";
import { semanticColors } from "@vendetta/ui";
import DeletedMessagesLog from "./DeletedMessagesLog.tsx";

const { TouchableOpacity, View } = General;
const ChannelStore = findByStoreName("ChannelStore");

// Lazy load navigation modules
let Navigation, Navigator, getRenderCloseButton;

const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;

storage.messageCache ??= {};
storage.deletedMessages ??= {};

const patches = [];

const styles = stylesheet.createThemedStyleSheet({
    iconContainer: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: semanticColors.BACKGROUND_MODIFIER_ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        tintColor: semanticColors.INTERACTIVE_NORMAL,
    }
});

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

function TrashButton({ channel }) {
    Navigation ??= findByProps("push", "pushLazy", "pop");
    Navigator ??= findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
    getRenderCloseButton ??= (findByProps("getRenderCloseButton")?.getRenderCloseButton ?? findByProps("getHeaderCloseButton")?.getHeaderCloseButton);

    const handlePress = () => {
        if (!Navigation || !Navigator || !getRenderCloseButton) {
            return logger.error("MessageLogger: Failed to get navigation modules.");
        }

        const navigator = () => (
            <Navigator
                initialRouteName="DeletedMessagesLog"
                screens={{
                    DeletedMessagesLog: {
                        title: `Deleted Msgs in #${channel.name}`,
                        headerLeft: getRenderCloseButton(() => Navigation.pop()),
                        render: () => <DeletedMessagesLog channelId={channel.id} />,
                    }
                }}
            />
        );
        Navigation.push(navigator);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            style={{ position: 'absolute', right: 16, top: 14, zIndex: 1 }}
        >
            <View style={styles.iconContainer}>
                <Forms.FormIcon style={styles.icon} source={getAssetIDByName("ic_trash_24px")} />
            </View>
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
                        <TrashButton channel={channel} />
                    </View>
                );
            }));
        } else {
            logger.error("MessageLogger: Could not find ChannelHeader component");
        }


    },
    onUnload: () => {
        patches.forEach(p => p?.());
        patches.length = 0;
        logger.log("MessageLogger unloaded.");
    }
};