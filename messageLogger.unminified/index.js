(function(exports,common,metro,toasts,_vendetta,plugin,patcher,utils,components,alerts){'use strict';metro.findByProps("openLazy", "hideActionSheet");
metro.findByProps("ActionSheetRow");
metro.findByProps("push", "pop");
metro.findByStoreName("ChannelStore");
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
let hasShownAlert = false;
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
      patches.push(patcher.after("default", ChannelHeader, function(args, res) {
        const channelId = args[0]?.channelId;
        if (!channelId || hasShownAlert)
          return;
        const hasDeleted = plugin.storage.deletedMessages[channelId]?.length > 0;
        if (!hasDeleted)
          return;
        hasShownAlert = true;
        const propsSet = /* @__PURE__ */ new Set();
        utils.findInReactTree(res, function(node) {
          if (node?.props) {
            const keys = Object.keys(node.props);
            if (keys.length > 0) {
              propsSet.add(`[${keys.join(", ")}]`);
            }
          }
          return false;
        });
        const propsString = Array.from(propsSet).join("\n");
        alerts.showConfirmationAlert({
          title: "Component Prop Keys",
          content: propsString || "No components with props found.",
          confirmText: "Copy",
          onConfirm: function() {
            common.clipboard.setString(propsString);
            toasts.showToast("Copied to clipboard.");
          },
          cancelText: "Close"
        });
      }));
    } else {
      _vendetta.logger.error("MessageLogger: Could not find ChannelHeader component");
    }
    _vendetta.logger.log("MessageLogger loaded for debugging component tree.");
  },
  onUnload: function() {
    patches.forEach(function(p) {
      return p?.();
    });
    patches.length = 0;
    hasShownAlert = false;
    _vendetta.logger.log("MessageLogger unloaded.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.metro,vendetta.ui.toasts,vendetta,vendetta.plugin,vendetta.patcher,vendetta.utils,vendetta.ui.components,vendetta.ui.alerts);