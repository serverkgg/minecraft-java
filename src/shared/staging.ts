export const STAGING_ROOT = ".serverk-staging";

export const UPLOAD_ROOT = ".serverk-uploads";

export const WORLD_STAGING = `${UPLOAD_ROOT}/world`;

export const PENDING_STAGING = `${UPLOAD_ROOT}/pending`;

export const relativeUploadPath = (input: string) => {
	const trimmed = input.trim();

	if (trimmed.length === 0 || trimmed.startsWith("/")) {
		return null;
	}

	const segments = trimmed.split("/").filter((segment) => segment.length > 0 && segment !== ".");

	if (segments.length === 0 || segments.includes("..")) {
		return null;
	}

	return segments.join("/");
};

export const isUnder = (path: string, directory: string) => {
	return path.startsWith(`${directory}/`) && path.length > directory.length + 1;
};
