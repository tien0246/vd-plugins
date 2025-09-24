import { React, ReactNative } from "@vendetta/metro/common";

const { View, Text } = ReactNative;

export default function DeletedMessagesLog({ channelId }: { channelId: string }) {
    return (
        <View style={{ flex: 1, backgroundColor: "#1E1F22", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>Hello from DeletedMessagesLog!</Text>
            <Text style={{ color: "white", marginTop: 8 }}>This is a test page.</Text>
            <Text style={{ color: "white", marginTop: 8 }}>Channel ID: {channelId}</Text>
        </View>
    );
}