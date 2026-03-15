"use client";

import { useMemo } from "react";
import { getSocket } from "@/lib/socket/socketClient";

export function useSocket() {
    return useMemo(() => getSocket(), []);
}
