import { NavigationContainer } from "@react-navigation/native";
import { View, ActivityIndicator } from "react-native";

import { useAuthBootstrap } from "../hooks/useAuthBootstrap";
import AuthStack from "./AuthStack";
import MainStack from "./MainStack";

export default function AppNavigator() {
    const { loading, isAuthenticated } = useAuthBootstrap();

    // ⏳ While checking session (SecureStore + /me)
    if (loading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // 🔐 Switch between auth and app
    return (
        <NavigationContainer>
            {isAuthenticated ? <MainStack /> : <AuthStack />}
        </NavigationContainer>
    );
}