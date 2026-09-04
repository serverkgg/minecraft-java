import { type Bridge, BridgeUserError } from "@serverkgg/bridge";

const PREFIX = "[ServerK]";

const COLOR = "gold";

const SPACING = /\s+/g;

export const CHAT_MESSAGE_LENGTH = 200;

export const messageArgument = (args: Bridge.Values) => {
	const message = String(args.message ?? "")
		.replaceAll(SPACING, " ")
		.trim();

	if (message.length === 0) {
		throw new BridgeUserError({
			ar: "اكتب الرسالة أول.",
			en: "Write the message first.",
		});
	}

	return message.slice(0, CHAT_MESSAGE_LENGTH);
};

export const tellrawAll = async (context: Bridge.Context, message: string) => {
	await context.command(
		`tellraw @a ${JSON.stringify({
			text: `${PREFIX} ${message}`,
			color: COLOR,
		})}`,
	);
};

export const titleAll = async (context: Bridge.Context, message: string) => {
	await context.command(
		`title @a title ${JSON.stringify({
			text: message,
			color: COLOR,
		})}`,
	);
};
