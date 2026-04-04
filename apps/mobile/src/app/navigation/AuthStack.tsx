import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "@/features/auth/screens/LoginScreen";
import RegisterScreen from "@/features/auth/screens/RegisterScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    );
}
