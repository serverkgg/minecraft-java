import { describe, expect, test } from "bun:test";
import { jvmFlags } from "./jvmFlags";

const flagOf = (flags: string[], name: string) => {
	return flags.find((flag) => flag.startsWith(name)) ?? null;
};

describe("g1 tuning from aikar's guide without the reservation flags", () => {
	test("the heap ceiling is the plan's heap, so the jvm never grows into memory the plan does not have", () => {
		expect(flagOf(jvmFlags(6144), "-Xmx")).toBe("-Xmx6144M");
		expect(flagOf(jvmFlags(1536), "-Xmx")).toBe("-Xmx1536M");
	});

	test("the jvm starts on a quarter of the heap and grows into the rest as the world needs it", () => {
		expect(flagOf(jvmFlags(6144), "-Xms")).toBe("-Xms1536M");
		expect(flagOf(jvmFlags(1536), "-Xms")).toBe("-Xms384M");
	});

	test("a small heap still starts on at least 256mb, never on less", () => {
		expect(flagOf(jvmFlags(512), "-Xms")).toBe("-Xms256M");
		expect(flagOf(jvmFlags(1024), "-Xms")).toBe("-Xms256M");
	});

	test("the starting heap never passes the ceiling, whatever the plan is", () => {
		for (const heapMb of [
			128,
			256,
			300,
			512,
			1536,
			6144,
			16_384,
		]) {
			const initial = Number(flagOf(jvmFlags(heapMb), "-Xms")?.slice(4, -1));

			expect(initial).toBeLessThanOrEqual(heapMb);
		}
	});

	test("the heap is never pre-touched, the container is memory capped and sold by the gigabyte", () => {
		for (const heapMb of [
			512,
			2048,
			6144,
			16_384,
		]) {
			expect(jvmFlags(heapMb)).not.toContain("-XX:+AlwaysPreTouch");
		}
	});

	test("a heap of twelve gigabytes or less gets the base tuning", () => {
		const flags = jvmFlags(6144);

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

	test("the set is exactly the tuning flags, with no marker the server is no longer entitled to", () => {
		expect(jvmFlags(2048)).toEqual([
			"-Xms512M",
			"-Xmx2048M",
			"-XX:+UseG1GC",
			"-XX:+ParallelRefProcEnabled",
			"-XX:MaxGCPauseMillis=200",
			"-XX:+UnlockExperimentalVMOptions",
			"-XX:+DisableExplicitGC",
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
		]);
	});
});
