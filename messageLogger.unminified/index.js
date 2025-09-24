(function(exports,common,metro,toasts,_vendetta){'use strict';let unpatch;
var index = {
  onLoad: function() {
    toasts.showToast("MessageLogger: onLoad called (v1)");
    _vendetta.logger.log("MessageLogger loaded.");
    const MessageStore = metro.findByStoreName("MessageStore");
    unpatch = common.FluxDispatcher.subscribe("MESSAGE_DELETE", function(action) {
      try {
        const message = MessageStore.getMessage(action.channelId, action.id);
        if (message && message.content) {
          const author = message.author?.username ?? "unknown";
          toasts.showToast(`Deleted from ${author}: ${message.content}`);
        }
      } catch (e) {
        _vendetta.logger.error("MessageLogger: Error in MESSAGE_DELETE", e);
      }
    });
  },
  onUnload: function() {
    unpatch?.();
    _vendetta.logger.log("MessageLogger unloaded.");
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro.common,vendetta.metro,vendetta.ui.toasts,vendetta);