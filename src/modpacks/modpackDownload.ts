import { type Bridge, BridgeDownloadError, BridgeUserError, describeDownloadFailure } from "@serverkgg/bridge";
import { createRequestPacer, fileNameOf, mapConcurrent, type RequestPacer, STAGING_ROOT } from "../shared";
import type { ModpackFile } from "./modpackIndex";

export const PACK_STAGING = `${STAGING_ROOT}/pack`;

export const LIBRARIES_STAGING = `${PACK_STAGING}/libraries`;

const PROGRESS_STEP = 10;

const DOWNLOAD_WIDTH = 4;

const THROTTLE_WAIT_MS = 65_000;

const DOWNLOAD_DEADLINE_MS = 15 * 60_000;

const THROTTLED_STATUS = 429;

const isThrottled = (error: unknown) => {
	return error instanceof BridgeDownloadError && error.status === THROTTLED_STATUS;
};

export const downloadFailure = (error: unknown, subject: string) => {
	return error instanceof BridgeDownloadError
		? new BridgeUserError(describeDownloadFailure(error, subject), {
				cause: error,
			})
		: error;
};

const wait = (ms: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

const downloadFile = async (context: Bridge.Context, file: ModpackFile, pacer: RequestPacer, deadline: number) => {
	const options = {
		cache: true,
		digest: file.digest,
		quiet: true,
		...(file.sizeBytes === null
			? {}
			: {
					sizeBytes: file.sizeBytes,
				}),
	};

	for (;;) {
		await pacer.acquire();

		try {
			await context.files.download(file.path, file.url, options);

			return;
		} catch (error) {
			if (!isThrottled(error) || Date.now() + THROTTLE_WAIT_MS >= deadline) {
				throw downloadFailure(error, fileNameOf(file.path));
			}

			context.log.warn("the download limit was reached, waiting before carrying on", {
				file: fileNameOf(file.path),
			});

			await wait(THROTTLE_WAIT_MS);
		}
	}
};

const totalBytesOf = (files: ModpackFile[]) => {
	let total = 0;

	for (const file of files) {
		if (file.sizeBytes === null) {
			return null;
		}

		total += file.sizeBytes;
	}

	return total;
};

export const downloadFiles = async (context: Bridge.Context, files: ModpackFile[]) => {
	const pacer = createRequestPacer();
	const started = Date.now();
	const deadline = started + DOWNLOAD_DEADLINE_MS;
	const total = files.length;
	const totalBytes = totalBytesOf(files);

	context.log("downloading the modpack's files", {
		files: total,
		sizeBytes: totalBytes,
	});

	let done = 0;
	let doneBytes = 0;
	let milestone = 0;

	await mapConcurrent(files, DOWNLOAD_WIDTH, async (file) => {
		await downloadFile(context, file, pacer, deadline);

		done += 1;
		doneBytes += file.sizeBytes ?? 0;

		const reached = Math.floor(
			totalBytes === null ? (done / total) * 100 : (doneBytes / Math.max(totalBytes, 1)) * 100,
		);

		if (reached >= milestone + PROGRESS_STEP && done < total) {
			milestone = Math.floor(reached / PROGRESS_STEP) * PROGRESS_STEP;

			context.log("downloading the modpack's files", {
				done: `${done}/${total}`,
				percent: milestone,
				file: fileNameOf(file.path),
			});
		}
	});

	context.log("downloaded the modpack's files", {
		files: total,
		sizeBytes: totalBytes,
		seconds: Math.round((Date.now() - started) / 1000),
	});
};
