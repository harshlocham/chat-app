import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ChatsList from "@/features/chat/screens/ChatsList";
import ChatScreen from "@/features/chat/screens/ChatScreen";
import type { ChatsStackParamList } from "@/app/navigation/types";

const Stack = createNativeStackNavigator<ChatsStackParamList>();

export default function ChatsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ChatsList" component={ChatsList} />
            <Stack.Screen name="ChatRoom" component={ChatScreen} />
        </Stack.Navigator>
    );
}
