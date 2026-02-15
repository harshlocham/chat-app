'use client'

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

/**
 * Render a horizontal emoji reaction bar that invokes a callback when an emoji is selected.
 *
 * @param onSelect - Callback invoked with the selected emoji string when a reaction button is clicked
 * @returns The reaction bar element containing buttons for each emoji
 */
export function ReactionBar({ onSelect }: { onSelect: (emoji: string) => void }) {
    return (
        <div className="absolute -bottom-8 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md flex gap-1 px-2 py-1">
            {EMOJIS.map((emoji) => (
                <button
                    key={emoji}
                    className="hover:scale-125 transition-transform text-lg"
                    onClick={() => onSelect(emoji)}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}