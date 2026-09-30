import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { activityExcerpt, BridgeEventName } from "@serverkgg/bridge/protocol";
import { messageArgument, tellrawAll, titleAll } from "../shared";

export enum BroadcastChannel {
	Chat = "chat",
	Title = "title",
}

const reportBroadcast = (context: Bridge.Context, channel: BroadcastChannel, message: string) => {
	const excerpt = activityExcerpt(message);

	context.activity.report({
		name: BridgeEventName.BroadcastSent,
		text:
			channel === BroadcastChannel.Chat
				? {
						ar: `تم إرسال رسالة بالشات: «${excerpt}»`,
						en: `Sent a chat message: "${excerpt}"`,
					}
				: {
						ar: `تم عرض رسالة على الشاشة: «${excerpt}»`,
						en: `Showed an on-screen message: "${excerpt}"`,
					},
		details: {
			channel,
			excerpt,
		},
	});
};

export const broadcast: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async say(context, args) {
			const message = messageArgument(args);

			await tellrawAll(context, message);

			reportBroadcast(context, BroadcastChannel.Chat, message);
		},

		async title(context, args) {
			const message = messageArgument(args);

			await titleAll(context, message);

			reportBroadcast(context, BroadcastChannel.Title, message);
		},
	},
};
