function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

describe("socket message fallback behavior", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function setup(options?: { hasConversation?: boolean }) {
        const handlers = new Map<string, (...args: unknown[]) => unknown>();

        const mockSocket = {
            on: jest.fn((event: string, cb: (...args: unknown[]) => unknown) => {
                handlers.set(event, cb);
                return mockSocket;
            }),
            off: jest.fn(),
            connected: false,
            connect: jest.fn(),
            disconnect: jest.fn(),
            io: { opts: {} as { extraHeaders?: Record<string, string> } },
        };

        jest.doMock("socket.io-client", () => ({
            io: jest.fn(() => mockSocket),
        }));

        jest.doMock(
            "@chat/types",
            () => ({
                SocketEvents: {
                    MESSAGE_NEW: "message:new",
                    CONVERSATION_CREATED: "conversation:created",
                    MESSAGE_DELETE: "message:delete",
                    MESSAGE_REACTION: "message:reaction",
                    TYPING_START: "typing:start",
                    TYPING_STOP: "typing:stop",
                },
            }),
            { virtual: true }
        );

        jest.doMock(
            "@chat/types/utils/message.guard",
            () => ({
                isMessageDTO: jest.fn(() => true),
            }),
            { virtual: true }
        );

        jest.doMock(
            "@/lib/socket/socketConfig",
            () => ({
                getClientSocketUrl: jest.fn(() => undefined),
            }),
            { virtual: true }
        );

        const state = {
            conversations: options?.hasConversation ? [{ _id: "conv-1" }] : [],
            upsertConversation: jest.fn(),
            receiveMessage: jest.fn(),
            updateDeletedMessage: jest.fn(),
            updateMessage: jest.fn(),
            setTyping: jest.fn(),
        };

        const useChatStoreMock: any = jest.fn();
        useChatStoreMock.getState = () => state;

        jest.doMock("@/store/chat-store", () => ({
            __esModule: true,
            default: useChatStoreMock,
        }));

        const module = require("@/hooks/socketClient") as {
            registerGlobalSocketListeners: () => void;
        };

        return {
            handlers,
            state,
            registerGlobalSocketListeners: module.registerGlobalSocketListeners,
        };
    }

    it("fetches and upserts conversation before receiving message when missing in state", async () => {
        const { handlers, state, registerGlobalSocketListeners } = setup({ hasConversation: false });

        const fetchedConversation = {
            _id: "conv-1",
            isGroup: false,
            type: "direct",
            participants: [],
            createdAt: "2026-04-10T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z",
        };

        jest.spyOn(global, "fetch").mockResolvedValue(
            jsonResponse(fetchedConversation, 200)
        );

        registerGlobalSocketListeners();

        const messageNewHandler = handlers.get("message:new");
        expect(messageNewHandler).toBeDefined();

        await messageNewHandler?.({
            _id: "msg-1",
            conversationId: "conv-1",
            sender: { _id: "user-2" },
            content: "hello",
            seen: false,
            delivered: false,
            seenBy: [],
            deliveredTo: [],
            createdAt: "2026-04-10T00:00:01.000Z",
            updatedAt: "2026-04-10T00:00:01.000Z",
        });

        expect(global.fetch).toHaveBeenCalledWith("/api/conversations/conv-1");
        expect(state.upsertConversation).toHaveBeenCalledWith(fetchedConversation);
        expect(state.receiveMessage).toHaveBeenCalledTimes(1);

        const receivedMessage = state.receiveMessage.mock.calls[0][0];
        expect(receivedMessage.conversationId).toBe("conv-1");
        expect(receivedMessage.createdAt instanceof Date).toBe(true);
        expect(receivedMessage.status).toBe("sent");
    });

    it("does not fetch conversation when it already exists in state", async () => {
        const { handlers, state, registerGlobalSocketListeners } = setup({ hasConversation: true });

        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
            jsonResponse({}, 200)
        );

        registerGlobalSocketListeners();

        const messageNewHandler = handlers.get("message:new");
        expect(messageNewHandler).toBeDefined();

        await messageNewHandler?.({
            _id: "msg-2",
            conversationId: "conv-1",
            sender: { _id: "user-3" },
            content: "already there",
            seen: false,
            delivered: false,
            seenBy: [],
            deliveredTo: [],
            createdAt: "2026-04-10T00:01:00.000Z",
            updatedAt: "2026-04-10T00:01:00.000Z",
        });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(state.upsertConversation).not.toHaveBeenCalled();
        expect(state.receiveMessage).toHaveBeenCalledTimes(1);
    });

    it("deduplicates conversation fetch for concurrent messages in missing conversation", async () => {
        const { handlers, state, registerGlobalSocketListeners } = setup({ hasConversation: false });

        const fetchedConversation = {
            _id: "conv-1",
            isGroup: false,
            type: "direct",
            participants: [],
            createdAt: "2026-04-10T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z",
        };

        let resolveFetch: ((value: Response) => void) | undefined;
        const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
            () =>
                new Promise<Response>((resolve) => {
                    resolveFetch = resolve;
                })
        );

        registerGlobalSocketListeners();

        const messageNewHandler = handlers.get("message:new");
        expect(messageNewHandler).toBeDefined();

        const firstMessagePromise = messageNewHandler?.({
            _id: "msg-3",
            conversationId: "conv-1",
            sender: { _id: "user-4" },
            content: "first",
            seen: false,
            delivered: false,
            seenBy: [],
            deliveredTo: [],
            createdAt: "2026-04-10T00:02:00.000Z",
            updatedAt: "2026-04-10T00:02:00.000Z",
        });

        const secondMessagePromise = messageNewHandler?.({
            _id: "msg-4",
            conversationId: "conv-1",
            sender: { _id: "user-5" },
            content: "second",
            seen: false,
            delivered: false,
            seenBy: [],
            deliveredTo: [],
            createdAt: "2026-04-10T00:02:01.000Z",
            updatedAt: "2026-04-10T00:02:01.000Z",
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(state.receiveMessage).not.toHaveBeenCalled();

        resolveFetch?.(jsonResponse(fetchedConversation, 200));

        await Promise.all([firstMessagePromise, secondMessagePromise]);

        expect(state.upsertConversation).toHaveBeenCalledTimes(1);
        expect(state.upsertConversation).toHaveBeenCalledWith(fetchedConversation);
        expect(state.receiveMessage).toHaveBeenCalledTimes(2);
    });
});
