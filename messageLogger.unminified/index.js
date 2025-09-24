(function(exports,common,metro,_vendetta,plugin,patcher,assets,components,alerts){'use strict';const { openAlert } = metro.findByProps("openAlert", "dismissAlert");
const { AlertModal, AlertActionButton } = metro.findByProps("AlertModal", "AlertActions");
const { Stack, TextInput } = metro.findByProps("Stack");
function showDialog(options) {
  if (AlertModal && AlertActionButton)
    showNewDialog(options);
  else
    alerts.showConfirmationAlert(options);
}
function showNewDialog({ title, content, placeholder, confirmText, cancelText, onConfirm }) {
  openAlert(generateDialogKey(title), /* @__PURE__ */ React.createElement(AlertModal, {
    title,
    content,
    actions: /* @__PURE__ */ React.createElement(Stack, null, /* @__PURE__ */ React.createElement(AlertActionButton, {
      text: confirmText,
      variant: "primary",
      onPress: onConfirm
    }), cancelText ? /* @__PURE__ */ React.createElement(AlertActionButton, {
      text: cancelText,
      variant: "secondary"
    }) : /* @__PURE__ */ React.createElement(React.Fragment, null))
  }));
}
function generateDialogKey(title) {
  return `vdarnfg-${title?.toLowerCase?.().replaceAll?.(" ", "-")}`;
}const { TouchableOpacity, View } = components.General;
const ChannelStore = metro.findByStoreName("ChannelStore");
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
function TrashButton({ channelId, channelName }) {
  return /* @__PURE__ */ common.React.createElement(TouchableOpacity, {
    onPress: function() {
      const deletedMessages = plugin.storage.deletedMessages?.[channelId] ?? [];
      const logContent = deletedMessages.slice(0, 10).map(function(msg) {
        return `[${new Date(msg.deletedTimestamp).toLocaleTimeString()}] ${msg.author}: ${msg.content}`;
      }).join("\n\n");
      showDialog({
        title: `Deleted Msgs in #${channelName}`,
        content: logContent || "No deleted messages logged.",
        confirmText: "Close"
      });
    },
    style: {
      position: "absolute",
      right: 50,
      top: 13,
      zIndex: 1
    }
  }, /* @__PURE__ */ common.React.createElement(components.Forms.FormIcon, {
    source: assets.getAssetIDByName("ic_trash_24px")
  }));
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
          channelId,
          channelName: channel.name
        }));
      }));
    } else {
      _vendetta.logger.error("MessageLogger: Could not find ChannelHeader component");
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
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.metro,vendetta,vendetta.plugin,vendetta.patcher,vendetta.ui.assets,vendetta.ui.components,vendetta.ui.alerts);