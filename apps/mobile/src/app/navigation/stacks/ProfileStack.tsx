import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ProfileScreen from "@/features/profile/screens/ProfileScreen";
import SettingsScreen from "@/features/profile/screens/SettingsScreen";
import type { ProfileStackParamList } from "@/app/navigation/types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
    );
}
