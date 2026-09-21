import { VERSION_PATTERN } from "../providers";
import { compareVersionDesc } from "../shared";

const familyOf = (candidate: string, exact: string) => {
	const parts = candidate.split(".");
	const target = exact.split(".");

	if (parts.length >= target.length) {
		return false;
	}

	return parts.every((part, index) => part === target[index]);
};

export const pickModpackVersion = (gameVersions: string[], current: string | null): string | null => {
	const numeric = gameVersions.filter((version) => VERSION_PATTERN.test(version));
	const exact = numeric.filter((version) => !numeric.some((other) => familyOf(version, other)));

	if (current !== null && exact.includes(current)) {
		return current;
	}

	return exact.sort(compareVersionDesc).at(0) ?? null;
};
