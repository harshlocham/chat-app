import { createStackNavigator } from "@react-navigation/stack";

import TabsNavigator from "./TabsNavigator";
// future:
// import ConversationListScreen from "../screens/home/ConversationListScreen";
// import ProfileScreen from "../screens/profile/ProfileScreen";

export type MainStackParamList = {
    MainTabs: undefined;
    profile: undefined;
    // Conversations: undefined;
    // Profile: undefined;
};

const Stack = createStackNavigator<MainStackParamList>();

export default function MainStack() {
    return (
        <Stack.Navigator id="MainStack">
            <Stack.Screen name="MainTabs" component={TabsNavigator} />
        </Stack.Navigator>
    );
}