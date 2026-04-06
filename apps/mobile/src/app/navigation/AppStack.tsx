import { createStackNavigator } from "@react-navigation/stack";
import TabsNavigator from "./TabsNavigator";
import ChatSocketBridge from "@/features/chat/socket/ChatSocketBridge";

import type { AppStackParamList } from "./types";

const Stack = createStackNavigator<AppStackParamList>();

export default function AppStack() {
    return (
        <>
            <ChatSocketBridge />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="TabsNavigator" component={TabsNavigator} />
            </Stack.Navigator>
        </>
    );
}
