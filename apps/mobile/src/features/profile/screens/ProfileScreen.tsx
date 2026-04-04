import { StackScreenProps } from "@react-navigation/stack";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/types";
import { useThemeContext } from "@/app/providers/ThemeProvider";

type ProfileScreenProps = StackScreenProps<ProfileStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
    const { theme, resolvedTheme, setTheme } = useThemeContext();

    const buttonClass = (value: "light" | "dark" | "system") =>
        theme === value
            ? "rounded-xl bg-slate-900 px-4 py-2"
            : "rounded-xl border border-slate-300 px-4 py-2";

    const buttonTextClass = (value: "light" | "dark" | "system") =>
        theme === value ? "text-white font-semibold" : "text-slate-700 font-semibold";

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <View className="flex-1 p-4 gap-4">
                <Text className="text-2xl font-bold text-slate-900 dark:text-slate-100">Profile</Text>
                <Text className="text-slate-600 dark:text-slate-300">Current theme: {theme}</Text>
                <Text className="text-slate-600 dark:text-slate-300">Resolved: {resolvedTheme}</Text>

                <View className="flex-row gap-2">
                    <Pressable className={buttonClass("light")} onPress={() => setTheme("light")}>
                        <Text className={buttonTextClass("light")}>Light</Text>
                    </Pressable>

                    <Pressable className={buttonClass("dark")} onPress={() => setTheme("dark")}>
                        <Text className={buttonTextClass("dark")}>Dark</Text>
                    </Pressable>

                    <Pressable className={buttonClass("system")} onPress={() => setTheme("system")}>
                        <Text className={buttonTextClass("system")}>System</Text>
                    </Pressable>
                </View>

                <Pressable
                    className="rounded-xl border border-slate-300 px-4 py-3"
                    onPress={() => navigation.navigate("Settings")}
                >
                    <Text className="text-slate-700 dark:text-slate-200 font-semibold">Open Settings</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}