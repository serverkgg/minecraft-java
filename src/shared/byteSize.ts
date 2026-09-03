const BASE_UNIT = "B";

const SIZE_UNITS = [
	BASE_UNIT,
	"KB",
	"MB",
	"GB",
	"TB",
];

const SIZE_STEP = 1024;

export const formatByteSize = (bytes: number) => {
	let value = bytes;
	let unit = 0;

	while (value >= SIZE_STEP && unit < SIZE_UNITS.length - 1) {
		value /= SIZE_STEP;
		unit += 1;
	}

	const symbol = SIZE_UNITS.at(unit) ?? BASE_UNIT;

	return unit === 0 ? `${value} ${symbol}` : `${value.toFixed(1)} ${symbol}`;
};
