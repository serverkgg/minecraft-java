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
			match: /(?<error>java\.lang\.OutOfMemoryError.*)/,
			emit: "ServerCrashed",
			stream: BridgeStream.Stderr,
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
	],
};
