import { BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { createRconAccess } from "@serverkgg/bridge/rcon";
import { generateRconPassword, rconPasswordOf, readInstallStamp, writeInstallStamp } from "../install";

export const rconAccess = createRconAccess({
	tools: {
		ar: "تشتغل mcrcon و RCON Console و Tempest كلها مع سيرفرات جافا.",
		en: "mcrcon, RCON Console and Tempest all work with Java servers.",
	},
	async password(context) {
		return rconPasswordOf(await readInstallStamp(context));
	},
	async rotate(context) {
		const stamp = await readInstallStamp(context);

		if (!stamp) {
			throw new BridgeUserError({
				ar: "شغّل سيرفرك مرة واحدة لتوليد كلمة المرور، ثم غيّرها.",
				en: "Start your server once so the password is generated, then change it.",
			});
		}

		await writeInstallStamp(context, {
			...stamp,
			rconPasswordNext: generateRconPassword(),
		});

		context.activity.report({
			name: BridgeEventName.SecretRotated,
			text: {
				ar: "تم تغيير كلمة مرور RCON",
				en: "Changed the RCON password",
			},
			subject: "RCON",
			details: {
				target: "rcon",
			},
		});
	},
});
