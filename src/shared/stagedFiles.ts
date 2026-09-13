import type { Bridge } from "@serverkgg/bridge";
import { STAGING_ROOT } from "./staging";

export interface StagedFile {
	path: string;
	url: string;
	digest?: string;
	sizeBytes?: number;
}

export const replaceFiles = async (
	context: Bridge.Context,
	files: StagedFile[],
	remove: string[],
	commit: () => Promise<void>,
) => {
	const root = `${STAGING_ROOT}/replacement`;
	await context.files.remove(root);
	await context.files.ensure(root);
	for (const [index, file] of files.entries()) {
		await context.files.download(`${root}/new-${index}`, file.url, {
			...(file.digest
				? {
						digest: file.digest,
					}
				: {}),
			...(file.sizeBytes === undefined
				? {}
				: {
						sizeBytes: file.sizeBytes,
					}),
		});
	}
	const parked: {
		path: string;
		backup: string;
	}[] = [];
	const applied: string[] = [];
	try {
		for (const [index, path] of [
			...new Set([
				...remove,
				...files.map((file) => file.path),
			]),
		].entries()) {
			if (!(await context.files.exists(path))) {
				continue;
			}
			const backup = `${root}/old-${index}`;
			await context.files.move(path, backup);
			parked.push({
				path,
				backup,
			});
		}
		for (const [index, file] of files.entries()) {
			await context.files.move(`${root}/new-${index}`, file.path);
			applied.push(file.path);
		}
		await commit();
	} catch (error) {
		for (const path of applied) {
			await context.files.remove(path);
		}
		for (const entry of parked.reverse()) {
			await context.files.move(entry.backup, entry.path);
		}
		throw error;
	}
	await context.files.remove(root);
};
