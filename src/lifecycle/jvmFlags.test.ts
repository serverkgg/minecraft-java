import { describe, expect, test } from "bun:test";
import { jvmFlags } from "./jvmFlags";

const flagOf = (flags: string[], name: string) => {
	return flags.find((flag) => flag.startsWith(name)) ?? null;
};

describe("aikar's g1 flags for the minecraft jvm", () => {
	test("the heap is fixed, so the jvm never grows into memory the plan does not have", () => {
		const flags = jvmFlags(6553);

		expect(flagOf(flags, "-Xms")).toBe("-Xms6553M");
		expect(flagOf(flags, "-Xmx")).toBe("-Xmx6553M");
	});

	test("a heap of twelve gigabytes or less gets the base tuning", () => {
		const flags = jvmFlags(6553);

		expect(flagOf(flags, "-XX:G1NewSizePercent")).toBe("-XX:G1NewSizePercent=30");
		expect(flagOf(flags, "-XX:G1MaxNewSizePercent")).toBe("-XX:G1MaxNewSizePercent=40");
		expect(flagOf(flags, "-XX:G1HeapRegionSize")).toBe("-XX:G1HeapRegionSize=8M");
		expect(flagOf(flags, "-XX:G1ReservePercent")).toBe("-XX:G1ReservePercent=20");
		expect(flagOf(flags, "-XX:InitiatingHeapOccupancyPercent")).toBe("-XX:InitiatingHeapOccupancyPercent=15");
	});

	test("a heap past twelve gigabytes gets the large-heap tuning", () => {
		const flags = jvmFlags(16_384);

		expect(flagOf(flags, "-XX:G1NewSizePercent")).toBe("-XX:G1NewSizePercent=40");
		expect(flagOf(flags, "-XX:G1MaxNewSizePercent")).toBe("-XX:G1MaxNewSizePercent=50");
		expect(flagOf(flags, "-XX:G1HeapRegionSize")).toBe("-XX:G1HeapRegionSize=16M");
		expect(flagOf(flags, "-XX:G1ReservePercent")).toBe("-XX:G1ReservePercent=15");
		expect(flagOf(flags, "-XX:InitiatingHeapOccupancyPercent")).toBe("-XX:InitiatingHeapOccupancyPercent=20");
	});

	test("twelve gigabytes exactly is still a base heap, the variant starts above it", () => {
		expect(flagOf(jvmFlags(12_288), "-XX:G1HeapRegionSize")).toBe("-XX:G1HeapRegionSize=8M");
		expect(flagOf(jvmFlags(12_289), "-XX:G1HeapRegionSize")).toBe("-XX:G1HeapRegionSize=16M");
	});

	test("the experimental options are unlocked before the flags that need them", () => {
		const flags = jvmFlags(2048);

		const unlock = flags.indexOf("-XX:+UnlockExperimentalVMOptions");

		for (const name of [
			"-XX:G1NewSizePercent",
			"-XX:G1MaxNewSizePercent",
			"-XX:G1MixedGCLiveThresholdPercent",
		]) {
			expect(flags.findIndex((flag) => flag.startsWith(name))).toBeGreaterThan(unlock);
		}
	});

	test("the whole set stays valid on java 8, the oldest runtime the image ships", () => {
		const flags = jvmFlags(2048);

		for (const flag of flags) {
			expect(flag.startsWith("--")).toBe(false);
			expect(flag.startsWith("-Xlog")).toBe(false);
		}
	});

	test("every flag the set carries is one aikar publishes", () => {
		expect(jvmFlags(2048)).toEqual([
			"-Xms2048M",
			"-Xmx2048M",
			"-XX:+UseG1GC",
			"-XX:+ParallelRefProcEnabled",
			"-XX:MaxGCPauseMillis=200",
			"-XX:+UnlockExperimentalVMOptions",
			"-XX:+DisableExplicitGC",
			"-XX:+AlwaysPreTouch",
			"-XX:G1NewSizePercent=30",
			"-XX:G1MaxNewSizePercent=40",
			"-XX:G1HeapRegionSize=8M",
			"-XX:G1ReservePercent=20",
			"-XX:G1HeapWastePercent=5",
			"-XX:G1MixedGCCountTarget=4",
			"-XX:InitiatingHeapOccupancyPercent=15",
			"-XX:G1MixedGCLiveThresholdPercent=90",
			"-XX:G1RSetUpdatingPauseTimePercent=5",
			"-XX:SurvivorRatio=32",
			"-XX:+PerfDisableSharedMem",
			"-XX:MaxTenuringThreshold=1",
			"-Dusing.aikars.flags=https://mcflags.emc.gs",
			"-Daikars.new.flags=true",
		]);
	});
});
