import { type Bridge, BridgeKind, BridgeStream } from "@serverkgg/bridge";

export const events: Bridge.Events = {
	kind: BridgeKind.Events,
	patterns: [
		{
			match: /(?<![\w.])(?<player>(?<skin>[\w,]{2,16})) joined the game/,
			emit: "PlayerJoined",
			payload: {
				platform: "java",
			},
		},
		{
			match: /(?<player>\.(?<skin>[\w,]{2,16})) joined the game/,
			emit: "PlayerJoined",
			payload: {
				platform: "bedrock",
			},
		},
		{
			match: /(?<![\w.])(?<player>(?<skin>[\w,]{2,16})) left the game/,
			emit: "PlayerLeft",
			payload: {
				platform: "java",
			},
		},
		{
			match: /(?<player>\.(?<skin>[\w,]{2,16})) left the game/,
			emit: "PlayerLeft",
			payload: {
				platform: "bedrock",
			},
		},
		{
			match: /Done \([\d.]+s\)! For help, type "help"/,
			emit: "ServerStarted",
		},
		{
			match: /Stopping the server/,
			emit: "ServerStopping",
		},
		{
			match: /Saved the game/,
			emit: "WorldSaved",
		},
		{
			match: /\[(?<player>\.?[\w,]{2,16}): Set own game mode to (?<mode>[\w ]+)\]/,
			emit: "GameModeChanged",
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) has made the advancement \[(?<advancement>[^\]]{1,64})\]$/,
			emit: "PlayerAdvanced",
			payload: {
				type: "advancement",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) has completed the challenge \[(?<advancement>[^\]]{1,64})\]$/,
			emit: "PlayerAdvanced",
			payload: {
				type: "challenge",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) has reached the goal \[(?<advancement>[^\]]{1,64})\]$/,
			emit: "PlayerAdvanced",
			payload: {
				type: "goal",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) was slain by (?<killer>.{1,64}?)(?: using .{1,64})?$/,
			emit: "PlayerDied",
			payload: {
				cause: "slain",
			},
		},
		{
			match:
				/\]: (?<player>\.?(?<skin>[\w,]{2,16})) was shot by (?:a skull from )?(?<killer>.{1,64}?)(?: using .{1,64})?$/,
			emit: "PlayerDied",
			payload: {
				cause: "shot",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) was blown up by (?<killer>.{1,64}?)(?: using .{1,64})?$/,
			emit: "PlayerDied",
			payload: {
				cause: "blown-up",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) was killed by \[Intentional Game Design\]$/,
			emit: "PlayerDied",
			payload: {
				cause: "intentional-game-design",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) blew up$/,
			emit: "PlayerDied",
			payload: {
				cause: "explosion",
			},
		},
		{
			match:
				/\]: (?<player>\.?(?<skin>[\w,]{2,16})) fell (?:from a high place|off a ladder|off scaffolding|while climbing|off some (?:twisting |weeping )?vines)$/,
			emit: "PlayerDied",
			payload: {
				cause: "fell",
			},
		},
		{
			match:
				/\]: (?<player>\.?(?<skin>[\w,]{2,16})) hit the ground too hard(?: while trying to escape (?<killer>.{1,64}))?$/,
			emit: "PlayerDied",
			payload: {
				cause: "hard-landing",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) drowned(?: while trying to escape (?<killer>.{1,64}))?$/,
			emit: "PlayerDied",
			payload: {
				cause: "drowned",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) tried to swim in lava(?: to escape (?<killer>.{1,64}))?$/,
			emit: "PlayerDied",
			payload: {
				cause: "lava",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) burned to death$/,
			emit: "PlayerDied",
			payload: {
				cause: "burned",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) went up in flames$/,
			emit: "PlayerDied",
			payload: {
				cause: "flames",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) starved to death(?: while fighting (?<killer>.{1,64}))?$/,
			emit: "PlayerDied",
			payload: {
				cause: "starved",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) suffocated in a wall(?: while fighting (?<killer>.{1,64}))?$/,
			emit: "PlayerDied",
			payload: {
				cause: "suffocated",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) was pricked to death$/,
			emit: "PlayerDied",
			payload: {
				cause: "pricked",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) withered away(?: while fighting (?<killer>.{1,64}))?$/,
			emit: "PlayerDied",
			payload: {
				cause: "withered",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) fell out of the world$/,
			emit: "PlayerDied",
			payload: {
				cause: "void",
			},
		},
		{
			match: /\]: (?<player>\.?(?<skin>[\w,]{2,16})) froze to death$/,
			emit: "PlayerDied",
			payload: {
				cause: "froze",
			},
		},
		{
			match: /(?<error>java\.lang\.OutOfMemoryError.*)/,
			emit: "ServerCrashed",
			stream: BridgeStream.Stderr,
		},
		{
			match:
				/You have allocated less memory\(\s*(?<allocatedMb>\d{2,6})\s*mb\s*\) than the recommended minimum for this pack:\s*(?<requiredMb>\d{2,6})\s*mb/i,
			emit: "MemoryUndersized",
		},
		{
			match:
				/You have less memory allocated\(\s*(?<allocatedMb>\d{2,6})\s*mb\s*\) than recommended for this pack, the minimum is:\s*(?<requiredMb>\d{2,6})\s*mb/i,
			emit: "MemoryUndersized",
		},
		{
			match: /Can't keep up! Is the server overloaded\? Running (?<ms>\d+)ms or (?<ticks>\d+) ticks behind/,
			emit: "TickLagging",
		},
		{
			match:
				/Can't keep up! Did the system time change, or is the server overloaded\? Running (?<ms>\d+)ms behind, skipping (?<ticks>\d+) tick/,
			emit: "TickLagging",
		},
		{
			match: /java\.lang\.UnsupportedClassVersionError: (?<detail>[^\n]{1,200})/,
			emit: "WrongJavaVersion",
		},
		{
			match: /(?:FAILED TO BIND TO PORT|java\.net\.BindException: Address already in use)/i,
			emit: "PortBindFailed",
		},
		{
			match: /(?:Exception reading|Failed to read) (?<path>[\w./\\-]*level\.dat)/,
			emit: "WorldCorrupt",
		},
		{
			match: /Failed to load level(?![\w-])/,
			emit: "WorldCorrupt",
		},
		{
			match:
				/Mod ID: '(?<dependency>[^']{1,64})', Requested by: '(?<mod>[^']{1,64})', Expected range: '(?<range>[^']{0,64})', Actual version: '(?<actual>[^']{0,64})'/,
			emit: "MissingDependency",
		},
		{
			match: /requires .{0,120}? of (?:mod )?'?(?<dependency>[\w.-]{1,64})'?, which is missing!/,
			emit: "MissingDependency",
		},
		{
			match: /Missing mandatory dependencies: (?<dependencies>[^\n]{1,120})/,
			emit: "MissingDependency",
		},
		{
			match:
				/Could not execute entrypoint stage '(?<stage>[A-Za-z]{1,32})' due to errors, provided by '(?<mod>[\w.-]{1,64})'/,
			emit: "ModCrashed",
			payload: {
				loader: "fabric",
			},
		},
		{
			match: /Mixin apply for mod (?<mod>[\w.-]{1,64}) failed/,
			emit: "ModCrashed",
			payload: {
				loader: "fabric",
			},
		},
		{
			match: /Failed to create mod instance\. ModID: (?<mod>[\w.-]{1,64})/,
			emit: "ModCrashed",
			payload: {
				loader: "forge",
			},
		},
		{
			match: /Failed to register automatic subscribers\. ModID: (?<mod>[\w.-]{1,64})/,
			emit: "ModCrashed",
			payload: {
				loader: "forge",
			},
		},
		{
			match: /Attempted to load class (?<detail>[\w/$.]{1,160}) for invalid dist DEDICATED_SERVER/,
			emit: "ModCrashed",
			payload: {
				reason: "client-class",
			},
		},
	],
	emits: [
		"ModCrashed",
	],
};
