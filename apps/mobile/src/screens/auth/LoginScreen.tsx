import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { login } from "../../auth/authService";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";

const getUserId = (user: unknown) => {
    if (!user || typeof user !== "object") {
        return null;
    }

    const value = user as { id?: unknown; _id?: unknown };

    if (typeof value.id === "string") {
        return value.id;
    }

    if (typeof value._id === "string") {
        return value._id;
    }

    return null;
};

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const setUser = useAuthStore.getState().setUser;
    const setCurrentUserId = useChatStore((s) => s.setCurrentUserId);
    const resetChatSession = useChatStore((s) => s.resetChatSession);

    const handleLogin = async () => {
        if (submitting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setErrorMessage("Email and password are required.");
            return;
        }

        setSubmitting(true);
        setErrorMessage("");

        try {
            const user = await login(trimmedEmail, password);
            resetChatSession();
            setUser(user);
            setCurrentUserId(getUserId(user));
        } catch (e: any) {
            const status = e?.response?.status;
            const serverMessage = e?.response?.data?.error;

            if (status === 401) {
                setErrorMessage("Invalid email or password.");
            } else if (status === 403) {
                setErrorMessage("Your account is not active.");
            } else if (typeof serverMessage === "string" && serverMessage.length > 0) {
                setErrorMessage(serverMessage);
            } else {
                setErrorMessage("Login failed. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-100">
            <View className="flex-1 justify-center items-center px-5">
                <View className="w-full max-w-96 bg-white rounded-2xl border border-slate-200 p-4 gap-3">
                    <Text className="text-2xl font-bold text-slate-900">Welcome Back</Text>
                    <Text className="text-sm text-slate-500">Sign in to continue.</Text>

                    <TextInput
                        className="min-h-11 border border-slate-300 rounded-xl px-3 text-base text-slate-900 bg-white"
                        placeholder="Email"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <TextInput
                        className="min-h-11 border border-slate-300 rounded-xl px-3 text-base text-slate-900 bg-white"
                        placeholder="Password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    {errorMessage ? (
                        <Text className="text-sm text-red-600">{errorMessage}</Text>
                    ) : null}

                    <Pressable
                        className="min-h-11 justify-center items-center rounded-xl bg-slate-900"
                        onPress={handleLogin}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text className="text-base font-semibold text-white">Sign in</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}