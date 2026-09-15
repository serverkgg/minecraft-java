const HEAP_FRACTION = 0.75;

const HEAP_FLOOR_MB = 512;

const HEAP_HEADROOM_MB = 512;

export const heapFor = (memoryMb: number) => {
	const headroom = memoryMb - HEAP_HEADROOM_MB;

	if (headroom < HEAP_FLOOR_MB) {
		throw new Error(
			`minecraft needs at least ${HEAP_FLOOR_MB + HEAP_HEADROOM_MB}mb of memory, this server has ${memoryMb}mb`,
		);
	}

	return Math.min(headroom, Math.floor(memoryMb * HEAP_FRACTION));
};
