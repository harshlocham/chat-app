import type { ClientMessage } from "./message.js";

export interface TempMessage extends Omit<ClientMessage, "_id"> {
    _id: `temp_${string}`;
    status: "pending" | "failed";
}