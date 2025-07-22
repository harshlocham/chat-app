import { z } from 'zod'


export const CreateMessageSchema = z.object({
    content: z.string().min(1),
    conversationId: z.string(),
    senderId: z.string()
})


export type CreateMessageInput = z.infer<typeof CreateMessageSchema>
