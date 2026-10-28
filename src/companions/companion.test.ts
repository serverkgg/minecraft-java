import { describe, expect, it } from "bun:test";
import { manifestSchema } from "@serverkgg/bridge/manifest";
import { ServerVariant } from "../shared";
import {
	advertisedAddressesOf,
	COMPANIONS,
	CompanionId,
	CROSSPLAY,
	FABRIC_API,
	geyserPropertiesOf,
	VOICE_CHAT,
	VOICE_PORT,
	WEBRTC_PORT,
} from "./companion";

const MANIFEST_PATH = `${import.meta.dir}/../../serverk.yml`;

const manifest = manifestSchema.parse(Bun.YAML.parse(await Bun.file(MANIFEST_PATH).text()));

const CROSSPLAY_ACTIVE_WHEN = [
	{
		variable: "SERVER_TYPE",
		values: CROSSPLAY.variants,
	},
	{
		variable: CROSSPLAY.variable,
		values: [
			"true",
		],
	},
];

describe("the bedrock address only exists when crossplay can run", () => {
	it("the bedrock port is live on the server types Geyser supports, with crossplay on", () => {
		const bedrock = manifest.container.ports.find((port) => port.key === "bedrock");

		expect(bedrock?.activeWhen).toMatchObject(CROSSPLAY_ACTIVE_WHEN);
	});

	it("the bedrock port takes tcp for NetherNet signaling beside udp for RakNet, on a number the server does not announce", () => {
		const bedrock = manifest.container.ports.find((port) => port.key === "bedrock");

		expect(bedrock).toMatchObject({
			containerPort: 19_132,
			protocol: "tcp+udp",
			mirror: false,
			hostRange: {
				default: 19_132,
				min: 19_132,
				max: 19_231,
			},
		});
	});

	it("the NetherNet port is a mirrored udp port inside the open media window, live exactly when the bedrock port is", () => {
		const webrtc = manifest.container.ports.find((port) => port.key === WEBRTC_PORT);

		expect(webrtc).toMatchObject({
			containerPort: 26_200,
			protocol: "udp",
			mirror: true,
			join: "separate",
			hostRange: {
				default: 26_200,
				min: 26_200,
				max: 26_299,
			},
			activeWhen: CROSSPLAY_ACTIVE_WHEN,
		});
	});

	it("the voice port is a mirrored udp port, live on the server types voice chat supports, with voice chat on", () => {
		const voice = manifest.container.ports.find((port) => port.key === VOICE_PORT);

		expect(voice).toMatchObject({
			protocol: "udp",
			mirror: true,
			activeWhen: [
				{
					variable: "SERVER_TYPE",
					values: VOICE_CHAT.variants,
				},
				{
					variable: VOICE_CHAT.variable,
					values: [
						"true",
					],
				},
			],
		});
	});

	it("the java port is always live", () => {
		const game = manifest.container.ports.find((port) => port.key === "game");

		expect(game?.activeWhen).toEqual([]);
	});
});

describe("a companion brings the libraries its loader needs", () => {
	const geyser = COMPANIONS.find((companion) => companion.id === CompanionId.Geyser);
	const floodgate = COMPANIONS.find((companion) => companion.id === CompanionId.Floodgate);

	it("the fabric builds of geyser and floodgate ask for fabric api, which they refuse to load without", () => {
		expect(geyser?.artifacts[ServerVariant.Fabric]?.requires).toEqual([
			FABRIC_API,
		]);
		expect(floodgate?.artifacts[ServerVariant.Fabric]?.requires).toEqual([
			FABRIC_API,
		]);
	});

	it("the neoforge and plugin builds need no library of their own", () => {
		for (const variant of [
			ServerVariant.NeoForge,
			ServerVariant.Paper,
			ServerVariant.Purpur,
		]) {
			expect(geyser?.artifacts[variant]?.requires).toEqual([]);
			expect(floodgate?.artifacts[variant]?.requires).toEqual([]);
		}
	});

	it("fabric api is read from modrinth for the version the server runs", () => {
		expect(FABRIC_API.project).toBe("P7dR8mSH");
		expect(FABRIC_API.loader).toBe("fabric");
		expect(FABRIC_API.files.test("fabric-api-0.145.5+26.2.jar")).toBe(true);
		expect(FABRIC_API.files.test("fabric-api.jar")).toBe(true);
		expect(FABRIC_API.files.test("fabric-carpet-1.4.166.jar")).toBe(false);
	});
});

describe("a mod build of a companion is pinned to the version the server runs", () => {
	const geyser = COMPANIONS.find((companion) => companion.id === CompanionId.Geyser);
	const floodgate = COMPANIONS.find((companion) => companion.id === CompanionId.Floodgate);

	it("the fabric and neoforge builds are read from modrinth for the version the server runs", () => {
		for (const variant of [
			ServerVariant.Fabric,
			ServerVariant.NeoForge,
		]) {
			expect(geyser?.artifacts[variant]?.modrinth?.matchGameVersion).toBe(true);
			expect(floodgate?.artifacts[variant]?.modrinth?.matchGameVersion).toBe(true);
		}
	});

	it("the fabric and neoforge builds of geyser never fall back to the newest build", () => {
		for (const variant of [
			ServerVariant.Fabric,
			ServerVariant.NeoForge,
		]) {
			expect(geyser?.artifacts[variant]?.download).toBeNull();
		}
	});

	it("the plugin builds of geyser still come from geysermc, where one jar spans versions", () => {
		for (const variant of [
			ServerVariant.Paper,
			ServerVariant.Purpur,
		]) {
			expect(geyser?.artifacts[variant]?.download).toMatchObject({
				project: "geyser",
			});
		}
	});
});

describe("only the voice chat mod's own jars count as the companion", () => {
	const voiceChat = COMPANIONS.find((companion) => companion.id === CompanionId.VoiceChat);

	const OWN_JARS = [
		"voicechat-bukkit.jar",
		"voicechat-bukkit-2.6.20.jar",
		"voicechat-fabric-1.20.1-2.6.27.jar",
		"voicechat-fabric-2.6.26+26.3.jar",
		"voicechat-forge-2.6.26+26.3.jar",
		"voicechat-neoforge-1.21.11-2.6.26.jar",
		"voicechat-neoforge-2.6.26+26.3.jar",
	];

	const ADDON_JARS = [
		"voicechat-interaction-1.0.3.jar",
		"voicechat-interaction-paper-v1.3.1+1.20.2.jar",
		"voicechat-names-26.3-1.0.2.jar",
		"voicechatworldguard-1.0.2.jar",
		"VoicechatUtils-1.3.0.jar",
	];

	for (const jar of OWN_JARS) {
		it(`claims ${jar}`, () => {
			expect(voiceChat?.files.test(jar)).toBe(true);
		});
	}

	for (const jar of ADDON_JARS) {
		it(`leaves the add-on ${jar} to the customer`, () => {
			expect(voiceChat?.files.test(jar)).toBe(false);
		});
	}

	it("builds every loader's jar for the version the server runs", () => {
		for (const variant of VOICE_CHAT.variants) {
			expect(voiceChat?.artifacts[variant]?.modrinth?.matchGameVersion).toBe(true);
		}
	});
});

describe("advertisedAddressesOf", () => {
	it("advertises the machine's public ipv4 address to NetherNet players", () => {
		expect(advertisedAddressesOf("203.0.113.5")).toEqual([
			"203.0.113.5",
		]);
	});

	const UNUSABLE = [
		null,
		"",
		"127.0.0.1",
		"0.0.0.0",
		"256.1.1.1",
		"2001:db8::1",
		"play.example.com",
	];

	for (const address of UNUSABLE) {
		it(`leaves the address to Geyser for ${JSON.stringify(address)}`, () => {
			expect(advertisedAddressesOf(address)).toEqual([]);
		});
	}
});

describe("geyserPropertiesOf", () => {
	it("turns NetherNet on beside RakNet on the allocated port and advertises the machine's address", () => {
		expect(geyserPropertiesOf(26_217, "203.0.113.5")).toEqual([
			"-DgeyserTransport=both",
			"-DgeyserWebrtcPort=26217",
			"-DgeyserAdvertiseAddresses=203.0.113.5",
		]);
	});

	it("leaves the advertised address to Geyser when the machine has only a loopback address", () => {
		expect(geyserPropertiesOf(26_217, "127.0.0.1")).toEqual([
			"-DgeyserTransport=both",
			"-DgeyserWebrtcPort=26217",
		]);
	});

	it("adds nothing when crossplay is off or the server type has no Geyser", () => {
		expect(geyserPropertiesOf(null, "203.0.113.5")).toEqual([]);
	});
});
