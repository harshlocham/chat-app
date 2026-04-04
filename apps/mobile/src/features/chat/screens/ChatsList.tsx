import { CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
    RootStackParamList,
    TabsParamList,
    ChatsStackParamList,
} from "@/app/navigation/types";

type ChatsListNavigationProp = CompositeNavigationProp<
    NativeStackNavigationProp<ChatsStackParamList, "ChatsList">,
    CompositeNavigationProp<
        BottomTabNavigationProp<TabsParamList, "ChatsTab">,
        NativeStackNavigationProp<RootStackParamList>
    >
>;

type ChatsListProps = {
    navigation: ChatsListNavigationProp;
};

export default function ChatsList({ navigation }: ChatsListProps) {
    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4 gap-3">
                <Text className="text-2xl font-bold text-slate-900">Chats</Text>

                <Pressable
                    className="rounded-xl bg-slate-900 px-4 py-3"
                    onPress={() => navigation.navigate("ChatRoom", { conversationId: "demo-conversation" })}
                >
                    <Text className="text-white font-semibold">Open ChatRoom</Text>
                </Pressable>

                <Pressable
                    className="rounded-xl border border-slate-300 px-4 py-3"
                    onPress={() => navigation.getParent()?.getParent()?.navigate("CallScreen", { callId: "demo-call" })}
                >
                    <Text className="text-slate-800 font-semibold">Open Global Call Modal</Text>
                </Pressable>

            </View>
        </SafeAreaView>
    );
}
