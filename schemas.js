import {z} from "zod";

export const RawMessageSchema = z.union([z.string(), z.instanceof(Buffer)]);

export const MessageSchema = z.object({
	roomId: z.string().min(1),
	sender: z.string().min(1),
	text: z.string().min(1),
});

export const ParsedMessageSchema = z
	.object({
		roomId: z.string().optional(),
		sender: z.string().optional(),
		text: z.string().optional(),
		type: z.string().optional(),
	})
	.refine(
		(data) => data.type === "pong" || (data.roomId && data.sender && data.text),
		{
			message:
				"Message must have roomId, sender, and text (unless it's a pong)",
		}
	);
