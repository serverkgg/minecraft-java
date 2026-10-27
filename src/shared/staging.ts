export const STAGING_ROOT = ".serverk-staging";

export const UPLOAD_ROOT = ".serverk-uploads";

export const WORLD_STAGING = `${UPLOAD_ROOT}/world`;

export const PENDING_STAGING = `${UPLOAD_ROOT}/pending`;

export const MODPACK_UPLOAD_STAGING = `${UPLOAD_ROOT}/modpack`;

export const PACKS_DIRECTORY = ".serverk-packs";

export const isUnder = (path: string, directory: string) => {
	return path.startsWith(`${directory}/`) && path.length > directory.length + 1;
};
