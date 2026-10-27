import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { relativeUploadPath } from "@serverkgg/bridge/utils";
import {
	matchPendingFile,
	modPath,
	type PendingFile,
	pendingMismatchMessage,
	readModpackSidecar,
	settlePendingSidecar,
	writeModpackSidecar,
} from "../modpacks";
import { isUnder, PENDING_STAGING } from "../shared";

const SHA1_ALGORITHM = "sha1";

const PENDING_EXTENSIONS = [
	"jar",
];

const CURSEFORGE_NOTE: Bridge.Text = {
	ar: "صاحب هذا المود لا يسمح بتنزيله إلا من CurseForge، لذلك نزّل هذا الملف نفسه من صفحته وارفعه هنا.",
	en: "This mod's author allows downloads only from CurseForge, so download this exact file from its page and upload it here.",
};

const filePage = (entry: PendingFile) => {
	return entry.pageUrl === null ? null : `${entry.pageUrl.replace(/\/+$/, "")}/files/${entry.fileId}`;
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
		sourceUrl: filePage(entry),
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
				ar: "لا توجد ملفات ناقصة لرفعها",
				en: "No files are missing, so there's nothing to upload",
			});
		}

		const source = await uploadedFile(context, input);

		if (source === null) {
			throw new BridgeUserError({
				ar: "تعذّر العثور على الملف المرفوع",
				en: "We couldn't find the uploaded file",
			});
		}

		const file = matchPendingFile(sidecar.pending, await context.files.digest(source, SHA1_ALGORITHM));

		if (file === null) {
			await context.files.remove(source);

			throw new BridgeUserError(pendingMismatchMessage(sidecar.pending));
		}

		const path = modPath(file.fileName);
		const remaining = sidecar.pending.filter((entry) => entry.fileId !== file.fileId);

		await context.files.move(source, path);

		await writeModpackSidecar(
			context,
			settlePendingSidecar(sidecar, {
				pending: remaining,
				present: [
					path,
				],
			}),
		);

		context.log("added a pending modpack file", {
			file: file.fileName,
			mod: file.name,
		});

		context.activity.report({
			name: BridgeEventName.ModInstalled,
			text: {
				ar: `تم رفع ${file.fileName} الناقص إلى مودباك ${sidecar.title}`,
				en: `Uploaded the missing ${file.fileName} for modpack ${sidecar.title}`,
			},
			subject: file.name,
			details: {
				kind: "mod",
				file: file.fileName,
				title: file.name,
				modpack: sidecar.title,
				remaining: remaining.length,
			},
		});
	},
};
