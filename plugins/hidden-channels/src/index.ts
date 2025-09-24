import { findByName, findByProps } from "@vendetta/metro";
import { constants, React } from "@vendetta/metro/common";
import { instead, after } from "@vendetta/patcher";
import { logger } from "@vendetta";
import HiddenChannel from "./HiddenChannel.jsx";

let patches = [];

function isHidden(channelIdOrObject: any | undefined) {
    const getChannel = findByProps("getChannel")?.getChannel;
    const ChannelTypes = findByProps("ChannelTypes")?.ChannelTypes;
    const Permissions = findByProps("getChannelPermissions", "can");

    if (!getChannel || !ChannelTypes || !Permissions) {
        logger.error("hidden-channels: Could not find core modules for isHidden check.");
        return false;
    }

    let channel = channelIdOrObject;
    if (typeof channel === 'string') channel = getChannel(channel);
    
    if (!channel || [ChannelTypes.DM, ChannelTypes.GROUP_DM, ChannelTypes.GUILD_CATEGORY].includes(channel.type)) return false;

    channel.realCheck = true;
    let res = !Permissions.can(constants.Permissions.VIEW_CHANNEL, channel);
    delete channel.realCheck;
    return res;
}

function onLoad() {
    try {
        const Permissions = findByProps("getChannelPermissions", "can");
        if (Permissions) {
            patches.push(after("can", Permissions, ([permID, channel], res) => {
                if (!channel?.realCheck && permID === constants.Permissions.VIEW_CHANNEL) return true;
                return res;
            }));
        } else {
            logger.error("hidden-channels: Failed to find Permissions module");
        }

        const Router = findByProps("transitionToGuild");
        if (Router) {
            patches.push(instead("transitionToGuild", Router, (args, orig) => {
                const [_, channel] = args;
                if (!isHidden(channel) && typeof orig === "function") orig(...args);
            }));
        } else {
            logger.error("hidden-channels: Failed to find Router module");
        }

        const Fetcher = findByProps("stores", "fetchMessages");
        if (Fetcher) {
            patches.push(instead("fetchMessages", Fetcher, (args, orig) => {
                const [channelId] = args;
                if (!isHidden(channelId) && typeof orig === "function") orig(...args);
            }));
        } else {
            logger.error("hidden-channels: Failed to find Fetcher module");
        }

        const MessagesConnected = findByName("ChannelMessages", false);
        if (MessagesConnected) {
            patches.push(instead("default", MessagesConnected, (args, orig) => {
                const channel = args[0]?.channel;
                if (!isHidden(channel) && typeof orig === "function") return orig(...args);
                else return React.createElement(HiddenChannel, {channel});
            }));
        } else {
            logger.error("hidden-channels: Failed to find ChannelMessages component");
        }
    } catch (e) {
        logger.error(`hidden-channels: onLoad error: ${e.message}`, e);
    }
}

export default {
    onLoad,
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        };
    }
}