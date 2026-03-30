import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthBootstrap } from "./src/hooks/useAuthBootstrap";
import { useAuthStore } from "./src/store/authStore";

export default function App() {
  useAuthBootstrap();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const clearError = useAuthStore((state) => state.clearError);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !isSubmitting;
  }, [email, password, isSubmitting]);

  const onPressLogin = async () => {
    if (!canSubmit) {
      return;
    }

    clearError();
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPressLogout = async () => {
    setIsSubmitting(true);
    try {
      await logout();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBootstrapping) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.muted}>Restoring session...</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Signed in</Text>
          <Text style={styles.value}>{user?.email ?? "Session active"}</Text>
          <Text style={styles.muted}>Mobile auth starter is connected.</Text>

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            disabled={isSubmitting}
            onPress={onPressLogout}
          >
            <Text style={styles.buttonText}>Logout</Text>
          </Pressable>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={onPressLogin}
        >
          <Text style={styles.buttonText}>{isSubmitting ? "Signing in..." : "Sign in"}</Text>
        </Pressable>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  center: {
    alignItems: "center",
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
  },
  value: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 10,
    borderWidth: 1,
    color: "#111827",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  muted: {
    color: "#6B7280",
    fontSize: 14,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
  },
});
