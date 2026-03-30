import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ChatScreen from "../screens/chat/ChatScreen";
// future:
// import ConversationListScreen from "../screens/home/ConversationListScreen";
// import ProfileScreen from "../screens/profile/ProfileScreen";

export type MainStackParamList = {
    Chat: undefined;
    // Conversations: undefined;
    // Profile: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
    return (
        <Stack.Navigator id="MainStack">
            <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ title: "Chat" }}
            />
        </Stack.Navigator>
    );
}