import { CompositeNavigationProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RootStackParamList } from "../../navigation/AppNavigator";
import { TabsParamList } from "../../navigation/TabsNavigator";
import { ChatsStackParamList } from "../../navigation/stacks/ChatsStack";

type ChatsListNavigationProp = CompositeNavigationProp<
    StackNavigationProp<ChatsStackParamList, "ChatsList">,
    CompositeNavigationProp<
        BottomTabNavigationProp<TabsParamList, "ChatsTab">,
        StackNavigationProp<RootStackParamList>
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




            </View>
        </SafeAreaView>
    );
}
