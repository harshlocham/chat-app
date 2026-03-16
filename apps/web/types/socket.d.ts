import { Server as IOServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../shared/types/SocketEvents";

type TypedIOServer = IOServer<
    ClientToServerEvents,
    ServerToClientEvents
>;

declare global {
    var io: TypedIOServer | undefined;
}

export { };