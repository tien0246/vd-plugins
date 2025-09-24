(function(metro,common,patcher,toasts,ui){'use strict';metro.findByProps("Button", "Text", "View");
metro.findByProps("extractTimestamp");
common.stylesheet.createThemedStyleSheet({
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
});metro.findByProps("getChannel")?.getChannel;
metro.findByProps("ChannelTypes")?.ChannelTypes;})(vendetta.metro,vendetta.metro.common,vendetta.patcher,vendetta.ui.toasts,vendetta.ui);