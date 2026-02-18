import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: number | string | Date) {
  const date = new Date(input); // works for ms timestamp OR ISO string
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const providedDate = new Date(date);
  providedDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - providedDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // Today
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // Yesterday
  if (diffDays === 1) {
    return "Yesterday";
  }

  // Within the last 7 days
  if (diffDays < 7 && diffDays > 0) {
    return date.toLocaleDateString([], { weekday: "long" }); // e.g. "Monday"
  }

  // Otherwise: full date
  return date.toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" });
}

export const isSameDay = (timestamp1: number, timestamp2: number): boolean => {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Define getRelativeDateTime function
export const getRelativeDateTime = (message: { _creationTime: number }, previousMessage: { _creationTime: number } | null) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const messageDate = new Date(message._creationTime);

  if (!previousMessage || !isSameDay(previousMessage._creationTime, messageDate.getTime())) {
    if (isSameDay(messageDate.getTime(), today.getTime())) {
      return "Today";
    } else if (isSameDay(messageDate.getTime(), yesterday.getTime())) {
      return "Yesterday";
    } else if (messageDate.getTime() > lastWeek.getTime()) {
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
      };
      return messageDate.toLocaleDateString(undefined, options);
    } else {
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      };
      return messageDate.toLocaleDateString(undefined, options);
    }
  }
};

export function randomID(len: number = 5): string {
  const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP";
  const maxPos = chars.length;
  let result = "";

  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos));
  }

  return result;
}
