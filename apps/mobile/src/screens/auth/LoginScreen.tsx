import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    Text,
    TextInput,
    View,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { login } from "../../auth/authService";
import { useAuthStore } from "../../store/authStore";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f1f5f9",
    },
    centerContent: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    card: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: "#ffffff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        padding: 16,
        gap: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#0f172a",
    },
    subtitle: {
        fontSize: 14,
        color: "#64748b",
    },
    input: {
        minHeight: 44,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 16,
        color: "#0f172a",
        backgroundColor: "#ffffff",
    },
    errorText: {
        fontSize: 14,
        color: "#dc2626",
    },
    button: {
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: "#0f172a",
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ffffff",
    },
});

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const setUser = useAuthStore((s) => s.setUser);

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
            setUser(user);
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
        <SafeAreaView style={styles.container}>
            <View style={styles.centerContent}>
                <View style={styles.card}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue.</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    {errorMessage ? (
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}

                    <Pressable
                        style={styles.button}
                        onPress={handleLogin}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Sign in</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}