import { describe, expect, it } from "bun:test";
import { mergeYaml } from "./yamlConfig";

const ADVERTISE_PATH = [
	"bedrock",
	"signaling",
	"advertise-addresses",
];

describe("mergeYaml", () => {
	it("writes a list as a flow sequence over an empty one", () => {
		const source = "bedrock:\n  signaling:\n    advertise-addresses: []\n    stun-discovery: true\n";

		const merged = mergeYaml(source, [
			{
				path: ADVERTISE_PATH,
				value: [
					"203.0.113.5",
				],
			},
		]);

		expect(merged).toBe('bedrock:\n  signaling:\n    advertise-addresses: ["203.0.113.5"]\n    stun-discovery: true\n');
	});

	it("replaces a block sequence Geyser saved, items and all, and keeps the next key", () => {
		const source = [
			"bedrock:",
			"  signaling:",
			"    advertise-addresses:",
			"    - 198.51.100.7",
			"    - play.example.com",
			"",
			"    # Finds this server's public address through STUN.",
			"    stun-discovery: true",
			"",
		].join("\n");

		const merged = mergeYaml(source, [
			{
				path: ADVERTISE_PATH,
				value: [],
			},
		]);

		expect(merged).toBe(
			[
				"bedrock:",
				"  signaling:",
				"    advertise-addresses: []",
				"",
				"    # Finds this server's public address through STUN.",
				"    stun-discovery: true",
				"",
			].join("\n"),
		);
	});

	it("replaces an indented block sequence", () => {
		const source = "signaling:\n  advertise-addresses:\n    - 198.51.100.7\n  mode: builtin\n";

		const merged = mergeYaml(source, [
			{
				path: [
					"signaling",
					"advertise-addresses",
				],
				value: [
					"203.0.113.5",
				],
			},
		]);

		expect(merged).toBe('signaling:\n  advertise-addresses: ["203.0.113.5"]\n  mode: builtin\n');
	});

	it("leaves a file that already carries the list unchanged", () => {
		const source = 'bedrock:\n  signaling:\n    advertise-addresses: ["203.0.113.5"]\n';

		const merged = mergeYaml(source, [
			{
				path: ADVERTISE_PATH,
				value: [
					"203.0.113.5",
				],
			},
		]);

		expect(merged).toBe(source);
	});

	it("adds a missing key under its parent", () => {
		const source = "bedrock:\n  port: 19132\njava:\n  auth-type: floodgate\n";

		const merged = mergeYaml(source, [
			{
				path: [
					"bedrock",
					"webrtc-port",
				],
				value: 26_217,
			},
		]);

		expect(merged).toBe("bedrock:\n  port: 19132\n  webrtc-port: 26217\njava:\n  auth-type: floodgate\n");
	});
});
