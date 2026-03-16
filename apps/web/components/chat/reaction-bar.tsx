'use client'

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

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