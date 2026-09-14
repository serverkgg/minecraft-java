import type { BridgeDriver } from "@serverkgg/bridge";
import { broadcast, gameplay } from "./actions";
import { addons } from "./addons";
import { announce } from "./announce";
import { backup } from "./backup";
import { bans, players, whitelist } from "./collections";
import { events } from "./events";
import { install, transitionPreview } from "./install";
import { lifecycle } from "./lifecycle";
import { modpackStatus, modpacks } from "./modpacks";
import { gameVersion, loaderBuild, serverType } from "./options";
import { panel } from "./panel";
import { pending } from "./pending";
import { query } from "./query";
import { rconAccess } from "./rcon";
import { settings, version } from "./settings";
import { setup } from "./setup";
import { terminal } from "./terminal";
import { worlds, worldTools } from "./worlds";

export const driver: BridgeDriver = {
	install,
	lifecycle,
	events,
	query,
	backup,
	announce,
	pending,
	setup,
	terminal,
	panel,
	modules: {
		serverType,
		gameVersion,
		loaderBuild,
		transitionPreview,
		version,
		settings,
		players,
		whitelist,
		bans,
		worlds,
		worldTools,
		addons,
		modpacks,
		modpackStatus,
		gameplay,
		broadcast,
		rconAccess,
	},
};
