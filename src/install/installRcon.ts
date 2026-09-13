import type { Bridge } from "@serverkgg/bridge";
import { RCON_PASSWORD_LENGTH, type RconAccessPassword, rconExposed } from "@serverkgg/bridge/rcon";
import { generateToken } from "@serverkgg/bridge/utils";
import { type InstallStamp, readInstallStamp, writeInstallStamp } from "./installStamp";

export const RCON_PORT = 25_575;

const PROPERTIES_FILE = "server.properties";

export type RconPasswords = Pick<InstallStamp, "rconPassword" | "rconPasswordNext">;

export interface LiveRconPassword {
	rconPassword: string;
	rconPasswordNext: null;
}

export const generateRconPassword = () => {
	return generateToken(RCON_PASSWORD_LENGTH);
};

export const promoteRconPassword = (
	passwords: RconPasswords,
	generate: () => string = generateRconPassword,
): LiveRconPassword => {
	return {
		rconPassword: passwords.rconPasswordNext ?? passwords.rconPassword ?? generate(),
		rconPasswordNext: null,
	};
};

export const rconPasswordOf = (passwords: RconPasswords | null): RconAccessPassword | null => {
	const value = passwords?.rconPasswordNext ?? passwords?.rconPassword ?? null;

	if (value === null) {
		return null;
	}

	return {
		value,
		pending: passwords?.rconPasswordNext !== null,
	};
};

export const rconProperties = (exposed: boolean, password: string): Bridge.Values => {
	return {
		"enable-rcon": exposed ? "true" : "false",
		"rcon.port": RCON_PORT,
		"rcon.password": password,
	};
};

export const pinRconProperties = async (context: Bridge.Context, identity?: InstallStamp) => {
	const stamp = identity ?? (await readInstallStamp(context));

	if (!stamp) {
		return;
	}

	const live = promoteRconPassword(stamp);

	await context.codec.properties.merge(PROPERTIES_FILE, rconProperties(rconExposed(context), live.rconPassword));

	if (identity || live.rconPassword !== stamp.rconPassword || stamp.rconPasswordNext !== null) {
		await writeInstallStamp(context, {
			...stamp,
			...live,
		});
	}
};
