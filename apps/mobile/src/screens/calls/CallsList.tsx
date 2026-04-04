import { StackScreenProps } from "@react-navigation/stack";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CallsStackParamList } from "../../navigation/stacks/CallsStack";

type CallsListProps = StackScreenProps<CallsStackParamList, "CallsList">;

export default function CallsList({ navigation }: CallsListProps) {
    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4 gap-3">
                <Text className="text-2xl font-bold text-slate-900">Calls</Text>
            </View>
        </SafeAreaView>
    );
}
