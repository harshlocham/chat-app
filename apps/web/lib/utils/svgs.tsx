import React from "react";

export function MessageSeenSvg() {
    return (
        <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="1 13 5 17 9 13" />
            <polyline points="7 13 11 17 23 5" />
        </svg>
    );
}
