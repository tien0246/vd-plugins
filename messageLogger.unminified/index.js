(function(exports,common,toasts,_vendetta,plugin){'use strict';const CACHE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1e3;
plugin.storage.messageCache ??= {};
const patches = [];
function pruneCache() {
  const now = Date.now();
  let prunedCount = 0;
  for (const id in plugin.storage.messageCache) {
    if (now - plugin.storage.messageCache[id].timestamp > CACHE_EXPIRY_MS) {
      delete plugin.storage.messageCache[id];
      prunedCount++;
    }
  }
  if (prunedCount > 0) {
    _vendetta.logger.log(`MessageLogger: Pruned ${prunedCount} expired messages from cache.`);
  }
}
function cacheMessage(message) {
  if (!message?.id || !message.content || message.author?.bot)
    return;
  plugin.storage.messageCache[message.id] = {
    content: message.content,
    author: message.author?.username ?? "unknown",
    timestamp: Date.now()
  };
}
var index = {
  onLoad: function() {
    pruneCache();
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_CREATE", function({ message }) {
      cacheMessage(message);
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_UPDATE", function({ message }) {
      if (message.content && plugin.storage.messageCache[message.id]) {
        cacheMessage(message);
      }
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_DELETE", function(action) {
      if (plugin.storage.messageCache[action.id]) {
        const cachedMessage = plugin.storage.messageCache[action.id];
        toasts.showToast(`Deleted from ${cachedMessage.author}: ${cachedMessage.content}`);
        delete plugin.storage.messageCache[action.id];
      }
    }));
    _vendetta.logger.log("MessageLogger loaded with persistent storage strategy.");
  },
  onUnload: function() {
    for (const unpatch of patches) {
      unpatch?.();
    }
    patches.length = 0;
    _vendetta.logger.log("MessageLogger unloaded.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.ui.toasts,vendetta,vendetta.plugin);