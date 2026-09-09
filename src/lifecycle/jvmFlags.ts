const LARGE_HEAP_MB = 12 * 1024;

const AIKARS_FLAGS = "https://mcflags.emc.gs";

interface HeapProfile {
	newSizePercent: number;
	maxNewSizePercent: number;
	regionSizeMb: number;
	reservePercent: number;
	initiatingHeapOccupancyPercent: number;
}

const BASE_HEAP: HeapProfile = {
	newSizePercent: 30,
	maxNewSizePercent: 40,
	regionSizeMb: 8,
	reservePercent: 20,
	initiatingHeapOccupancyPercent: 15,
};

const LARGE_HEAP: HeapProfile = {
	newSizePercent: 40,
	maxNewSizePercent: 50,
	regionSizeMb: 16,
	reservePercent: 15,
	initiatingHeapOccupancyPercent: 20,
};

export const jvmFlags = (heapMb: number) => {
	const profile = heapMb > LARGE_HEAP_MB ? LARGE_HEAP : BASE_HEAP;

	return [
		`-Xms${heapMb}M`,
		`-Xmx${heapMb}M`,
		"-XX:+UseG1GC",
		"-XX:+ParallelRefProcEnabled",
		"-XX:MaxGCPauseMillis=200",
		"-XX:+UnlockExperimentalVMOptions",
		"-XX:+DisableExplicitGC",
		"-XX:+AlwaysPreTouch",
		`-XX:G1NewSizePercent=${profile.newSizePercent}`,
		`-XX:G1MaxNewSizePercent=${profile.maxNewSizePercent}`,
		`-XX:G1HeapRegionSize=${profile.regionSizeMb}M`,
		`-XX:G1ReservePercent=${profile.reservePercent}`,
		"-XX:G1HeapWastePercent=5",
		"-XX:G1MixedGCCountTarget=4",
		`-XX:InitiatingHeapOccupancyPercent=${profile.initiatingHeapOccupancyPercent}`,
		"-XX:G1MixedGCLiveThresholdPercent=90",
		"-XX:G1RSetUpdatingPauseTimePercent=5",
		"-XX:SurvivorRatio=32",
		"-XX:+PerfDisableSharedMem",
		"-XX:MaxTenuringThreshold=1",
		`-Dusing.aikars.flags=${AIKARS_FLAGS}`,
		"-Daikars.new.flags=true",
	];
};
