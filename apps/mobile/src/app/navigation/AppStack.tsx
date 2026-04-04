import { createNativeStackNavigator } from "@react-navigation/native-stack";

import TabsNavigator from "./TabsNavigator";
import type { AppStackParamList } from "./types";

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="TabsNavigator" component={TabsNavigator} />
        </Stack.Navigator>
    );
}
