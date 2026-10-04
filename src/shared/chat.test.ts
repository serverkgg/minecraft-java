import { describe, expect, it } from "bun:test";
import { CHAT_MESSAGE_LENGTH, messageArgument } from "./chat";

describe("reading the message an action is about to say in chat", () => {
	it("a plain message comes back as it is", () => {
		expect(
			messageArgument({
				message: "السيرفر بيرستارت",
			}),
		).toBe("السيرفر بيرستارت");
	});

	it("runs of whitespace, including newlines, collapse to single spaces", () => {
		expect(
			messageArgument({
				message: "  restart   in\n\tfive  ",
			}),
		).toBe("restart in five");
	});

	it("an empty message is refused", () => {
		expect(() =>
			messageArgument({
				message: "   ",
			}),
		).toThrow();
		expect(() => messageArgument({})).toThrow();
	});

	it("a long message is cut to the chat limit", () => {
		const message = messageArgument({
			message: "n".repeat(CHAT_MESSAGE_LENGTH + 50),
		});

		expect(message.length).toBe(CHAT_MESSAGE_LENGTH);
	});
});
