import { SocketEvents, type MessageSemanticUpdatedPayload, type TaskCreatedPayload, type TaskLinkedToMessagePayload, type TaskUpdatedPayload } from "@chat/types";
import useChatStore from "@/store/chat-store";
import useTaskStore from "@/store/task-store";
import type { TypedSocket } from "@/hooks/socketClient";

function patchMessageSemanticState(payload: MessageSemanticUpdatedPayload) {
	const chatStore = useChatStore.getState();
	const messages = chatStore.messagesByConversation[payload.conversationId] || [];

	const nextMessages = messages.map((message) => {
		if (String(message._id) !== payload.messageId) return message;

		return {
			...message,
			semanticType: payload.semanticType,
			semanticConfidence: payload.semanticConfidence,
			aiStatus: payload.aiStatus,
			aiVersion: payload.aiVersion,
			linkedTaskIds: payload.linkedTaskIds,
			semanticProcessedAt:
				typeof payload.semanticProcessedAt === "string"
					? payload.semanticProcessedAt
					: payload.semanticProcessedAt.toISOString(),
		};
	});

	useChatStore.setState({
		messagesByConversation: {
			...chatStore.messagesByConversation,
			[payload.conversationId]: nextMessages,
		},
	});
}

export function registerTaskSocketListeners(socket: TypedSocket) {
	const taskStore = useTaskStore.getState();

	socket.on(SocketEvents.TASK_CREATED, (payload: TaskCreatedPayload) => {
		taskStore.handleTaskCreated(payload);
	});

	socket.on(SocketEvents.TASK_UPDATED, (payload: TaskUpdatedPayload) => {
		taskStore.patchTask(payload);
	});

	socket.on(SocketEvents.TASK_LINKED_TO_MESSAGE, (payload: TaskLinkedToMessagePayload) => {
		taskStore.linkTaskToMessage(payload);
	});

	socket.on(SocketEvents.MESSAGE_SEMANTIC_UPDATED, (payload: MessageSemanticUpdatedPayload) => {
		taskStore.setMessageSemanticState(payload);
		patchMessageSemanticState(payload);
	});
}
