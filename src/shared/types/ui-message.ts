import { ClientMessage } from "./client-message.js";
import { TempMessage } from "./temp-message.js";

export type UIMessage = ClientMessage | TempMessage;