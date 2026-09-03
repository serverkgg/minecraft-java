import { type Bridge, BridgeHoldReason } from "@serverkgg/bridge";
import { modPath } from "./modpackIndex";
import { type ModpackSidecar, type PendingFile, readModpackSidecar, writeModpackSidecar } from "./modpackSidecar";

const SHA1_ALGORITHM = "sha1";

const NAME_SEPARATOR = "، ";

export interface PendingReconcile {
	pending: PendingFile[];
	present: string[];
}

export const matchPendingFile = (pending: PendingFile[], sha1: string) => {
	const wanted = sha1.toLowerCase();

	return pending.find((file) => file.sha1.toLowerCase() === wanted) ?? null;
};

export const pendingMismatchMessage = (pending: PendingFile[]): Bridge.Text => {
	const names = pending.map((file) => file.fileName).join(NAME_SEPARATOR);

	return {
		ar: `هذا مو الملف اللي ننتظره. المطلوب: ${names}`,
		en: `this is not a file we are waiting for, we need: ${names}`,
	};
};

export const pendingHold = (pending: PendingFile[]): Bridge.InstallOutcome | undefined => {
	return pending.length === 0
		? undefined
		: {
				hold: {
					count: pending.length,
					reason: BridgeHoldReason.PendingFiles,
				},
			};
};

export const settlePendingSidecar = (sidecar: ModpackSidecar, reconcile: PendingReconcile): ModpackSidecar => {
	return {
		...sidecar,
		files:
			sidecar.files === null
				? null
				: [
						...new Set([
							...sidecar.files,
							...reconcile.present,
						]),
					],
		pending: reconcile.pending,
	};
};

const pendingFileArrived = async (context: Bridge.Context, file: PendingFile, path: string) => {
	if (!(await context.files.exists(path))) {
		return false;
	}

	return (
		matchPendingFile(
			[
				file,
			],
			await context.files.digest(path, SHA1_ALGORITHM),
		) !== null
	);
};

export const reconcilePendingFiles = async (
	context: Bridge.Context,
	pending: PendingFile[],
): Promise<PendingReconcile> => {
	const remaining: PendingFile[] = [];
	const present: string[] = [];

	for (const file of pending) {
		const path = modPath(file.fileName);

		if (await pendingFileArrived(context, file, path)) {
			present.push(path);
		} else {
			remaining.push(file);
		}
	}

	return {
		pending: remaining,
		present,
	};
};

export const settlePendingFiles = async (context: Bridge.Context): Promise<PendingFile[]> => {
	const sidecar = await readModpackSidecar(context);

	if (!sidecar || sidecar.pending.length === 0) {
		return [];
	}

	const reconcile = await reconcilePendingFiles(context, sidecar.pending);

	if (reconcile.present.length > 0) {
		context.log("the modpack files you uploaded are in place", {
			files: reconcile.present.length,
			waiting: reconcile.pending.length,
		});

		await writeModpackSidecar(context, settlePendingSidecar(sidecar, reconcile));
	}

	return reconcile.pending;
};
