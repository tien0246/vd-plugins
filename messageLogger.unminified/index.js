(function(exports,common,metro,_vendetta,plugin,patcher,assets,components,ui){'use strict';const { ScrollView, View: View$1, Text } = common.ReactNative;
const { FormDivider } = components.Forms;
const ChannelStore$1 = metro.findByStoreName("ChannelStore");
const styles$1 = common.stylesheet.createThemedStyleSheet({
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
  const channel = ChannelStore$1.getChannel(channelId);
  const deletedMessages = plugin.storage.deletedMessages?.[channelId] ?? [];
  return /* @__PURE__ */ common.React.createElement(ScrollView, {
    style: styles$1.container
  }, deletedMessages.length > 0 ? deletedMessages.map(function(msg, index) {
    return /* @__PURE__ */ common.React.createElement(common.React.Fragment, {
      key: msg.id + index
    }, /* @__PURE__ */ common.React.createElement(View$1, {
      style: styles$1.logEntry
    }, /* @__PURE__ */ common.React.createElement(Text, {
      style: styles$1.author
    }, msg.author), /* @__PURE__ */ common.React.createElement(Text, {
      style: styles$1.content
    }, msg.content), /* @__PURE__ */ common.React.createElement(Text, {
      style: styles$1.timestamp
    }, "Deleted at: ", new Date(msg.deletedTimestamp).toLocaleString())), /* @__PURE__ */ common.React.createElement(FormDivider, null));
  }) : /* @__PURE__ */ common.React.createElement(Text, {
    style: styles$1.emptyState
  }, "No deleted messages logged for #", channel?.name, "."));
}const { TouchableOpacity, View } = components.General;
const ChannelStore = metro.findByStoreName("ChannelStore");
let Navigation, Navigator, getRenderCloseButton;
const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1e3;
plugin.storage.messageCache ??= {};
plugin.storage.deletedMessages ??= {};
const patches = [];
const styles = common.stylesheet.createThemedStyleSheet({
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ui.semanticColors.BACKGROUND_MODIFIER_ACCENT,
    justifyContent: "center",
    alignItems: "center"
  },
  icon: {
    tintColor: ui.semanticColors.INTERACTIVE_NORMAL
  }
});
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
    if (plugin.storage.deletedMessages[channelId].length === 0) {
      delete plugin.storage.deletedMessages[channelId];
    }
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
function TrashButton({ channel }) {
  Navigation ??= metro.findByProps("push", "pushLazy", "pop");
  Navigator ??= metro.findByName("Navigator") ?? metro.findByProps("Navigator")?.Navigator;
  getRenderCloseButton ??= metro.findByProps("getRenderCloseButton")?.getRenderCloseButton ?? metro.findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
  const handlePress = function() {
    if (!Navigation || !Navigator || !getRenderCloseButton) {
      return _vendetta.logger.error("MessageLogger: Failed to get navigation modules.");
    }
    const navigator = function() {
      return /* @__PURE__ */ common.React.createElement(Navigator, {
        initialRouteName: "DeletedMessagesLog",
        screens: {
          DeletedMessagesLog: {
            title: `Deleted Msgs in #${channel.name}`,
            headerLeft: getRenderCloseButton(function() {
              return Navigation.pop();
            }),
            render: function() {
              return /* @__PURE__ */ common.React.createElement(DeletedMessagesLog, {
                channelId: channel.id
              });
            }
          }
        }
      });
    };
    Navigation.push(navigator);
  };
  return /* @__PURE__ */ common.React.createElement(TouchableOpacity, {
    onPress: handlePress,
    style: {
      position: "absolute",
      right: 16,
      top: 16,
      zIndex: 1
    }
  }, /* @__PURE__ */ common.React.createElement(View, {
    style: styles.iconContainer
  }, /* @__PURE__ */ common.React.createElement(components.Forms.FormIcon, {
    style: styles.icon,
    source: assets.getAssetIDByName("ic_trash_24px")
  })));
}
var index = {
  onLoad: function() {
    pruneCache();
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_CREATE", function({ message }) {
      return cacheMessage(message);
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_UPDATE", function({ message: u }) {
      const old = plugin.storage.messageCache[u.id];
      if (old && u.content && old.content !== u.content) {
        const history = old.editHistory ?? [];
        history.push({
          content: old.content,
          timestamp: old.timestamp
        });
        plugin.storage.messageCache[u.id] = {
          ...old,
          content: u.content,
          timestamp: Date.now(),
          editHistory: history
        };
      }
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_DELETE", function(a) {
      const m = plugin.storage.messageCache[a.id];
      if (m) {
        plugin.storage.deletedMessages[a.channelId] ??= [];
        plugin.storage.deletedMessages[a.channelId].unshift({
          id: a.id,
          content: m.content,
          author: m.author,
          deletedTimestamp: new Date().toISOString()
        });
        if (plugin.storage.deletedMessages[a.channelId].length > 100)
          plugin.storage.deletedMessages[a.channelId].pop();
        delete plugin.storage.messageCache[a.id];
      }
    }));
    const ChannelHeader = metro.findByName("ChannelHeader", false);
    if (ChannelHeader) {
      patches.push(patcher.instead("default", ChannelHeader, function(args, orig) {
        const originalHeader = orig(...args);
        const channelId = args[0]?.channelId;
        if (!channelId)
          return originalHeader;
        const channel = ChannelStore.getChannel(channelId);
        if (!channel)
          return originalHeader;
        const hasDeleted = plugin.storage.deletedMessages[channelId]?.length > 0;
        if (!hasDeleted)
          return originalHeader;
        return /* @__PURE__ */ common.React.createElement(View, {
          style: {
            flex: 1
          }
        }, originalHeader, /* @__PURE__ */ common.React.createElement(TrashButton, {
          channel
        }));
      }));
    } else {
      _vendetta.logger.error("MessageLogger: Could not find ChannelHeader component");
    }
    _vendetta.logger.log("MessageLogger v1.0.3 loaded.");
  },
  onUnload: function() {
    patches.forEach(function(p) {
      return p?.();
    });
    patches.length = 0;
    _vendetta.logger.log("MessageLogger unloaded.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.metro,vendetta,vendetta.plugin,vendetta.patcher,vendetta.ui.assets,vendetta.ui.components,vendetta.ui);