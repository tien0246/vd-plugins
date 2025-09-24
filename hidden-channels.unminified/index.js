(function(exports,metro,common,patcher,ui,assets){'use strict';const { View, Text, Pressable } = metro.findByProps("Button", "Text", "View");
const snowflakeUtils = metro.findByProps("extractTimestamp");
const MessageStyles = common.stylesheet.createThemedStyleSheet({
  "container": {
    "flex": 1,
    "padding": 16,
    "alignItems": "center",
    "justifyContent": "center"
  },
  "title": {
    "fontFamily": common.constants.Fonts.PRIMARY_SEMIBOLD,
    "fontSize": 24,
    "textAlign": "left",
    "color": ui.semanticColors.HEADER_PRIMARY,
    "paddingVertical": 25
  },
  "text": {
    "flex": 1,
    "flexDirection": "row",
    "fontSize": 16,
    "textAlign": "justify",
    "color": ui.semanticColors.HEADER_PRIMARY
  },
  "dateContainer": {
    "height": 16,
    "alignSelf": "baseline"
  }
});
function FancyDate({ date }) {
  return /* @__PURE__ */ common.React.createElement(Pressable, {
    style: MessageStyles.dateContainer,
    onPress: function() {
      common.toasts.open({
        content: common.moment(date).toLocaleString(),
        source: assets.getAssetIDByName("clock")
      });
    },
    onLongPress: function() {
      common.clipboard.setString(date.getTime().toString());
      common.toasts.open({
        content: "Copied to clipboard"
      });
    }
  }, /* @__PURE__ */ common.React.createElement(Text, {
    style: MessageStyles.text
  }, common.moment(date).fromNow()));
}
function HiddenChannel({ channel }) {
  return /* @__PURE__ */ common.React.createElement(View, {
    style: MessageStyles.container
  }, /* @__PURE__ */ common.React.createElement(Text, {
    style: MessageStyles.title
  }, "This channel is hidden."), /* @__PURE__ */ common.React.createElement(Text, {
    style: MessageStyles.text
  }, "Topic: ", channel.topic || "No topic.", "\n\n", "Creation date: ", /* @__PURE__ */ common.React.createElement(FancyDate, {
    date: new Date(snowflakeUtils.extractTimestamp(channel.id))
  }), "\n\n", "Last message: ", channel.lastMessageId ? /* @__PURE__ */ common.React.createElement(FancyDate, {
    date: new Date(snowflakeUtils.extractTimestamp(channel.lastMessageId))
  }) : "No messages.", "\n\n", "Last pin: ", channel.lastPinTimestamp ? /* @__PURE__ */ common.React.createElement(FancyDate, {
    date: new Date(channel.lastPinTimestamp)
  }) : "No pins."));
}let patches = [];
const Permissions = metro.findByProps("getChannelPermissions", "can");
const Router = metro.findByProps("transitionToGuild");
const Fetcher = metro.findByProps("stores", "fetchMessages");
const { ChannelTypes } = metro.findByProps("ChannelTypes");
const { getChannel } = metro.findByProps("getChannel");
const skipChannels = [
  ChannelTypes.DM,
  ChannelTypes.GROUP_DM,
  ChannelTypes.GUILD_CATEGORY
];
function isHidden(channel) {
  if (channel == void 0)
    return false;
  if (typeof channel === "string")
    channel = getChannel(channel);
  if (!channel || skipChannels.includes(channel.type))
    return false;
  channel.realCheck = true;
  let res = !Permissions.can(common.constants.Permissions.VIEW_CHANNEL, channel);
  delete channel.realCheck;
  return res;
}
function onLoad() {
  const MessagesConnected = metro.findByName("MessagesWrapperConnected", false);
  patches.push(patcher.after("can", Permissions, function([permID, channel], res) {
    if (!channel?.realCheck && permID === common.constants.Permissions.VIEW_CHANNEL)
      return true;
    return res;
  }));
  patches.push(patcher.instead("transitionToGuild", Router, function(args, orig) {
    const [_, channel] = args;
    if (!isHidden(channel) && typeof orig === "function")
      orig(args);
  }));
  patches.push(patcher.instead("fetchMessages", Fetcher, function(args, orig) {
    const [channel] = args;
    if (!isHidden(channel) && typeof orig === "function")
      orig(args);
  }));
  patches.push(patcher.instead("default", MessagesConnected, function(args, orig) {
    const channel = args[0]?.channel;
    if (!isHidden(channel) && typeof orig === "function")
      return orig(...args);
    else
      return common.React.createElement(HiddenChannel, {
        channel
      });
  }));
}
var index = {
  onLoad,
  onUnload: function() {
    for (const unpatch of patches) {
      unpatch();
    }
  }
};exports.default=index;Object.defineProperty(exports,'__esModule',{value:true});return exports;})({},vendetta.metro,vendetta.metro.common,vendetta.patcher,vendetta.ui,vendetta.ui.assets);