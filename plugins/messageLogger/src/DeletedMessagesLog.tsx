import { React, ReactNative, stylesheet } from "@vendetta/metro/common";
import { findByStoreName, findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { Forms, General } from "@vendetta/ui/components";
import { semanticColors } from "@vendetta/ui";

const { ScrollView, View, Text } = ReactNative;
const { FormDivider } = Forms;
const ChannelStore = findByStoreName("ChannelStore");
const Parser = findByProps("parse", "parseTopic");

const styles = stylesheet.createThemedStyleSheet({
    container: {
        flex: 1,
        backgroundColor: semanticColors.BACKGROUND_PRIMARY,
    },
    logEntry: {
        padding: 16,
    },
    author: {
        color: semanticColors.HEADER_PRIMARY,
        fontWeight: "bold",
        marginBottom: 4,
    },
    contentContainer: {
        // The parser will apply its own text styles
    },
    timestamp: {
        color: semanticColors.TEXT_MUTED,
        fontSize: 12,
        marginTop: 4,
    },
    emptyState: {
        color: semanticColors.TEXT_MUTED,
        textAlign: "center",
        marginTop: 20,
    }
});

export default function DeletedMessagesLog({ channelId }: { channelId: string }) {
    const channel = ChannelStore.getChannel(channelId);
    const deletedMessages = storage.deletedMessages?.[channelId] ?? [];

    return (
        <ScrollView style={styles.container}>
            {deletedMessages.length > 0 ? (
                deletedMessages.map((msg, index) => (
                    <React.Fragment key={msg.id + index}>
                        <View style={styles.logEntry}>
                            <Text style={styles.author}>{msg.author}</Text>
                            <Text style={styles.contentContainer}>
                                {Parser.parse(msg.content, true, { channelId: channelId })}
                            </Text>
                            <Text style={styles.timestamp}>
                                Deleted at: {new Date(msg.deletedTimestamp).toLocaleString()}
                            </Text>
                        </View>
                        <FormDivider />
                    </React.Fragment>
                ))
            ) : (
                <Text style={styles.emptyState}>
                    No deleted messages logged for #{channel?.name}.
                </Text>
            )}
        </ScrollView>
    );
}