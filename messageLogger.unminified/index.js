(function(exports,common,toasts,_vendetta){'use strict';const messageCache = /* @__PURE__ */ new Map();
const CACHE_EXPIRY_MS = 15 * 60 * 1e3;
const patches = [];
function cacheMessage(message) {
  if (!message?.id || !message.content || message.author?.bot)
    return;
  if (messageCache.has(message.id)) {
    const existing = messageCache.get(message.id);
    clearTimeout(existing.timer);
  }
  const timer = setTimeout(function() {
    messageCache.delete(message.id);
  }, CACHE_EXPIRY_MS);
  messageCache.set(message.id, {
    content: message.content,
    author: message.author?.username ?? "unknown",
    timer
  });
}
var index = {
  onLoad: function() {
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_CREATE", function({ message }) {
      cacheMessage(message);
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_UPDATE", function({ message }) {
      if (message.content) {
        cacheMessage(message);
      }
    }));
    patches.push(common.FluxDispatcher.subscribe("MESSAGE_DELETE", function(action) {
      if (messageCache.has(action.id)) {
        const cachedMessage = messageCache.get(action.id);
        toasts.showToast(`Deleted from ${cachedMessage.author}: ${cachedMessage.content}`);
        clearTimeout(cachedMessage.timer);
        messageCache.delete(action.id);
      }
    }));
    _vendetta.logger.log("MessageLogger loaded with caching strategy.");
  },
  onUnload: function() {
    for (const unpatch of patches) {
      unpatch?.();
    }
    patches.length = 0;
    for (const [_id, cachedMessage] of messageCache) {
      clearTimeout(cachedMessage.timer);
    }
    messageCache.clear();
    _vendetta.logger.log("MessageLogger unloaded and cache cleared.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.ui.toasts,vendetta);