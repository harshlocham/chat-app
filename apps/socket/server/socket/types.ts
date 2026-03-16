import { Socket as IOSocket } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
} from "@chat/types";

export type SocketData = {
    userId: string;
    isAdmin: boolean;
};

export type TypedSocket = IOSocket<
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData
>;