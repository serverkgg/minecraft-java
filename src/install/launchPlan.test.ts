import { describe, expect, test } from "bun:test";
import { argsTarget, jarLaunch, LaunchKind, launchArguments } from "./launchPlan";

describe("finding the argument file a loader's run script points at", () => {
	test("a neoforge run script names its argument file under libraries", () => {
		expect(
			argsTarget(
				'#!/usr/bin/env sh\njava @user_jvm_args.txt @libraries/net/neoforged/neoforge/21.1.176/unix_args.txt "$@"\n',
			),
		).toBe("libraries/net/neoforged/neoforge/21.1.176/unix_args.txt");
	});

	test("a forge run script names its own directory", () => {
		expect(argsTarget("java @libraries/net/minecraftforge/forge/1.20.1-47.4.0/unix_args.txt")).toBe(
			"libraries/net/minecraftforge/forge/1.20.1-47.4.0/unix_args.txt",
		);
	});

	test("a script with no argument file answers with nothing", () => {
		expect(argsTarget("#!/usr/bin/env sh\njava -jar server.jar nogui\n")).toBeNull();
		expect(argsTarget("")).toBeNull();
	});
});

describe("turning a launch plan into java arguments", () => {
	test("an argument file is passed with an at sign and nothing else", () => {
		expect(
			launchArguments({
				kind: LaunchKind.Args,
				target: "libraries/unix_args.txt",
			}),
		).toEqual([
			"@libraries/unix_args.txt",
		]);
	});

	test("a jar is passed with -jar", () => {
		expect(launchArguments(jarLaunch)).toEqual([
			"-jar",
			"server.jar",
		]);
	});
});
