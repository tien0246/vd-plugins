(function(exports,common,metro,toasts,_vendetta){'use strict';let unpatch;
var index = {
  onLoad: function() {
    toasts.showToast("MessageLogger: onLoad called (v2)");
    _vendetta.logger.log("MessageLogger loaded.");
    const MessageStore = metro.findByStoreName("MessageStore");
    if (!MessageStore) {
      toasts.showToast("ML Error: Could not find MessageStore!");
      return;
    }
    unpatch = common.FluxDispatcher.subscribe("MESSAGE_DELETE", function(action) {
      toasts.showToast("ML: MESSAGE_DELETE received!");
      try {
        const message = MessageStore.getMessage(action.channelId, action.id);
        if (message && message.content) {
          const author = message.author?.username ?? "unknown";
          toasts.showToast(`Deleted from ${author}: ${message.content}`);
        } else {
          toasts.showToast(`ML: Deleted msg [${action.id}] not in cache or has no content.`);
        }
      } catch (e) {
        _vendetta.logger.error("MessageLogger: Error in MESSAGE_DELETE", e);
        toasts.showToast(`ML Error: ${e.message}`);
      }
    });
  },
  onUnload: function() {
    unpatch?.();
    _vendetta.logger.log("MessageLogger unloaded.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.metro,vendetta.ui.toasts,vendetta);