import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import {
	matchPendingFile,
	modPath,
	type PendingFile,
	pendingMismatchMessage,
	readModpackSidecar,
	settlePendingSidecar,
	writeModpackSidecar,
} from "../modpacks";
import { isUnder, PENDING_STAGING, relativeUploadPath } from "../shared";

const SHA1_ALGORITHM = "sha1";

const PENDING_EXTENSIONS = [
	"jar",
];

const CURSEFORGE_NOTE: Bridge.Text = {
	ar: "صاحب هذا المود ما يسمح بتحميله إلا من كيرس فورج، فنزّله من صفحته وارفعه هنا.",
	en: "This mod's author allows downloads only from CurseForge, so download it from its page and upload it here.",
};

export const pendingFileOf = (entry: PendingFile): Bridge.PendingFile => {
	return {
		id: String(entry.fileId),
		title: {
			ar: entry.name,
			en: entry.name,
		},
		fileName: entry.fileName,
		sizeBytes: entry.sizeBytes,
		digest: `${SHA1_ALGORITHM}:${entry.sha1}`,
		sourceUrl: entry.pageUrl,
		note: CURSEFORGE_NOTE,
	};
};

const uploadedFile = async (context: Bridge.Context, input: string) => {
	const source = relativeUploadPath(input);

	if (source === null || !isUnder(source, PENDING_STAGING) || !(await context.files.exists(source))) {
		return null;
	}

	return source;
};

export const pending: Bridge.Pending = {
	kind: BridgeKind.Pending,

	staging: PENDING_STAGING,

	extensions: PENDING_EXTENSIONS,

	async list(context) {
		const sidecar = await readModpackSidecar(context);

		return (sidecar?.pending ?? []).map(pendingFileOf);
	},

	async add(context, input) {
		const sidecar = await readModpackSidecar(context);

		if (!sidecar || sidecar.pending.length === 0) {
			throw new BridgeUserError({
				ar: "ما فيه ملفات ناقصة عشان ترفعها",
				en: "no files are missing, so there is nothing to upload",
			});
		}

		const source = await uploadedFile(context, input);

		if (source === null) {
			throw new BridgeUserError({
				ar: "ما لقينا الملف اللي رفعته",
				en: "the uploaded file was not found",
			});
		}

		const file = matchPendingFile(sidecar.pending, await context.files.digest(source, SHA1_ALGORITHM));

		if (file === null) {
			await context.files.remove(source);

			throw new BridgeUserError(pendingMismatchMessage(sidecar.pending));
		}

		const path = modPath(file.fileName);

		await context.files.move(source, path);

		await writeModpackSidecar(
			context,
			settlePendingSidecar(sidecar, {
				pending: sidecar.pending.filter((entry) => entry.fileId !== file.fileId),
				present: [
					path,
				],
			}),
		);

		context.log("added a pending modpack file", {
			file: file.fileName,
			mod: file.name,
		});
	},
};
