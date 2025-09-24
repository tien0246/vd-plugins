(function(exports,common,metro,toasts,_vendetta,plugin,patcher,utils,assets,components,ui){'use strict';const { ScrollView, View, Text } = components.General;
const { FormRow, FormDivider } = components.Forms;
const ChannelStore = metro.findByStoreName("ChannelStore");
const styles = common.stylesheet.createThemedStyleSheet({
  container: {
    flex: 1,
    backgroundColor: ui.semanticColors.BACKGROUND_PRIMARY
  },
  logEntry: {
    padding: 16
  },
  author: {
    color: ui.semanticColors.HEADER_PRIMARY,
    fontWeight: "bold",
    marginBottom: 4
  },
  content: {
    color: ui.semanticColors.TEXT_NORMAL
  },
  timestamp: {
    color: ui.semanticColors.TEXT_MUTED,
    fontSize: 12,
    marginTop: 4
  },
  emptyState: {
    color: ui.semanticColors.TEXT_MUTED,
    textAlign: "center",
    marginTop: 20
  }
});
function DeletedMessagesLog({ channelId }) {
  const channel = ChannelStore.getChannel(channelId);
  const deletedMessages = plugin.storage.deletedMessages?.[channelId] ?? [];
  return /* @__PURE__ */ common.React.createElement(ScrollView, {
    style: styles.container
  }, deletedMessages.length > 0 ? deletedMessages.map(function(msg, index) {
    return /* @__PURE__ */ common.React.createElement(common.React.Fragment, {
      key: msg.id + index
    }, /* @__PURE__ */ common.React.createElement(View, {
      style: styles.logEntry
    }, /* @__PURE__ */ common.React.createElement(Text, {
      style: styles.author
    }, msg.author), /* @__PURE__ */ common.React.createElement(Text, {
      style: styles.content
    }, msg.content), /* @__PURE__ */ common.React.createElement(Text, {
      style: styles.timestamp
    }, "Deleted at: ", new Date(msg.deletedTimestamp).toLocaleString())), /* @__PURE__ */ common.React.createElement(FormDivider, null));
  }) : /* @__PURE__ */ common.React.createElement(Text, {
    style: styles.emptyState
  }, "No deleted messages logged for #", channel?.name, "."));
}const { TouchableOpacity } = components.General;
metro.findByProps("openLazy", "hideActionSheet");
metro.findByProps("ActionSheetRow");
const Navigation = metro.findByProps("push", "pop");
const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1e3;
plugin.storage.messageCache ??= {};
plugin.storage.deletedMessages ??= {};
const patches = [];
function pruneCache() {
  const now = Date.now();
  Object.keys(plugin.storage.messageCache).forEach(function(id) {
    if (now - plugin.storage.messageCache[id].timestamp > CACHE_EXPIRY_MS)
      delete plugin.storage.messageCache[id];
  });
  Object.keys(plugin.storage.deletedMessages).forEach(function(channelId) {
    plugin.storage.deletedMessages[channelId] = plugin.storage.deletedMessages[channelId].filter(function(msg) {
      return now - new Date(msg.deletedTimestamp).getTime() < CACHE_EXPIRY_MS;
    });
  });
}
function cacheMessage(message) {
  if (!message?.id || !message.content || message.author?.bot)
    return;
  const existingData = plugin.storage.messageCache[message.id];
  plugin.storage.messageCache[message.id] = {
    content: message.content,
    author: message.author?.username ?? "unknown",
    timestamp: Date.now(),
    editHistory: existingData?.editHistory ?? []
  };
}
var index = {
  onLoad: function() {
    pruneCache();
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_CREATE", function({ message }) {
      return cacheMessage(message);
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_UPDATE", function({ message: updatedMessage }) {
      const oldCachedMessage = plugin.storage.messageCache[updatedMessage.id];
      if (oldCachedMessage && updatedMessage.content && oldCachedMessage.content !== oldCachedMessage.content) {
        const newEditHistory = oldCachedMessage.editHistory ?? [];
        newEditHistory.push({
          content: oldCachedMessage.content,
          timestamp: oldCachedMessage.timestamp
        });
        plugin.storage.messageCache[updatedMessage.id] = {
          ...oldCachedMessage,
          content: updatedMessage.content,
          timestamp: Date.now(),
          editHistory: newEditHistory
        };
      }
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_DELETE", function(action) {
      const cachedMessage = plugin.storage.messageCache[action.id];
      if (cachedMessage) {
        const { channelId } = action;
        plugin.storage.deletedMessages[channelId] ??= [];
        plugin.storage.deletedMessages[channelId].unshift({
          id: action.id,
          content: cachedMessage.content,
          author: cachedMessage.author,
          deletedTimestamp: new Date().toISOString()
        });
        if (plugin.storage.deletedMessages[channelId].length > 100)
          plugin.storage.deletedMessages[channelId].pop();
        delete plugin.storage.messageCache[action.id];
      }
    }));
    const ChannelHeader = metro.findByName("ChannelHeader", false);
    if (ChannelHeader) {
      patches.push(patcher.after("default", ChannelHeader, function(args, res) {
        const propsKeys = Object.keys(args[0] ?? {}).join(", ");
        toasts.showToast(`CH Props keys: ${propsKeys}`);
        const channel = args[0]?.channel;
        if (!channel)
          return;
        const channelId = channel.id;
        const hasDeleted = plugin.storage.deletedMessages[channelId]?.length > 0;
        if (!hasDeleted)
          return;
        const title = utils.findInReactTree(res, function(r) {
          return r?.type?.name === "HeaderTitle";
        });
        if (!title?.props?.children)
          return;
        if (!Array.isArray(title.props.children))
          title.props.children = [
            title.props.children
          ];
        title.props.children.push(/* @__PURE__ */ common.React.createElement(TouchableOpacity, {
          onPress: function() {
            Navigation.push("VendettaCustomPage", {
              title: `Deleted Msgs in #${channel.name}`,
              render: function() {
                return /* @__PURE__ */ common.React.createElement(DeletedMessagesLog, {
                  channelId
                });
              }
            });
          },
          style: {
            marginRight: 8
          }
        }, /* @__PURE__ */ common.React.createElement(components.Forms.FormIcon, {
          source: assets.getAssetIDByName("ic_trash_24px")
        })));
      }));
    }
    _vendetta.logger.log("MessageLogger loaded with UI.");
  },
  onUnload: function() {
    patches.forEach(function(p) {
      return p?.();
    });
    patches.length = 0;
    _vendetta.logger.log("MessageLogger unloaded.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.metro,vendetta.ui.toasts,vendetta,vendetta.plugin,vendetta.patcher,vendetta.utils,vendetta.ui.assets,vendetta.ui.components,vendetta.ui);