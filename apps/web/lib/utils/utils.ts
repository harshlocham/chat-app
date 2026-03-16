import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(value: string | number | Date | undefined | null): string {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const isSameDay = date.toDateString() === now.toDateString();

    if (isSameDay) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    }

    const diffMs = now.getTime() - date.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (diffMs < sevenDaysMs) {
        return date.toLocaleDateString([], { weekday: "short" });
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
