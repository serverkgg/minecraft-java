import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { installedLayout } from "../install/installLayout";
import { formatByteSize, isUnder, relativeUploadPath, WORLD_STAGING } from "../shared";
import {
	activeWorld,
	discoverWorlds,
	findLevelDirectories,
	freeWorldName,
	mainLevelDirectories,
	setActiveWorld,
	type WorldImport,
	worldBaseName,
	worldDimensions,
	worldImportNotice,
	worldPaths,
	worldSize,
} from "./world";
import { cloneWorld, exportWorld, inspectJavaWorld, worldNameArgument } from "./worldTools";

const ACTIVE_MARK = "✓";

const IMPORT_REPORT_LIMIT = 5;

const nameOf = (path: string) => {
	return path.split("/").at(-1) ?? "";
};

const uploadedWorldDirectories = async (context: Bridge.Context, source: string) => {
	const found = await findLevelDirectories(context, source);

	if (found.length === 0) {
		throw new BridgeUserError({
			ar: "ما لقينا ملف level.dat جوّا الملف المضغوط، تأكد إنك ضاغط مجلد الماب نفسه",
			en: "the archive holds no level.dat, make sure you zipped the world folder itself",
		});
	}

	if (found.includes(source)) {
		return [
			source,
		];
	}

	return mainLevelDirectories(found);
};

const reportWiped = (context: Bridge.Context, world: string, scope: string, text: Bridge.Text) => {
	context.activity.report({
		name: BridgeEventName.WorldWiped,
		text,
		subject: world,
		details: {
			world,
			scope,
		},
	});
};

const reportImported = (context: Bridge.Context, imported: WorldImport[]) => {
	if (imported.length <= IMPORT_REPORT_LIMIT) {
		for (const { folder, name } of imported) {
			context.activity.report({
				name: BridgeEventName.WorldImported,
				text: {
					ar: `تم استيراد ماب ${name}`,
					en: `Imported world ${name}`,
				},
				subject: name,
				details: {
					world: name,
					folder,
				},
			});
		}

		return;
	}

	const named = imported.slice(0, IMPORT_REPORT_LIMIT).map((world) => world.name);

	context.activity.report({
		name: BridgeEventName.WorldImported,
		text: {
			ar: `تم استيراد مابات ${named.join("، ")} وغيرها (${imported.length})`,
			en: `Imported worlds ${named.join(", ")} and more (${imported.length})`,
		},
		details: {
			count: imported.length,
			worlds: named.join(", "),
		},
	});
};

const refuseActiveWorld = async (context: Bridge.Context, name: string) => {
	if ((await activeWorld(context)) !== name) {
		return;
	}

	throw new BridgeUserError({
		ar: "ما تقدر تحذف الماب الشغّالة، فعّل ماب ثانية أول",
		en: "you cannot delete the active world, activate another one first",
	});
};

export const worlds: Bridge.Collection = {
	kind: BridgeKind.Collection,
	protectedActions: [
		"delete",
		"resetNether",
		"resetEnd",
	],

	async list(context) {
		const active = await activeWorld(context);
		const rows: Bridge.Row[] = [];

		for (const name of await discoverWorlds(context)) {
			rows.push({
				id: name,
				name,
				size: formatByteSize(await worldSize(context, name)),
				active: name === active ? ACTIVE_MARK : "",
				path: `.serverk-exports/${name}.zip`,
			});
		}

		return rows;
	},

	async add(context, input) {
		const source = relativeUploadPath(input);

		if (source === null || !isUnder(source, WORLD_STAGING) || !(await context.files.exists(source))) {
			throw new BridgeUserError({
				ar: "ما لقينا الملفات اللي رفعتها",
				en: "the uploaded files were not found",
			});
		}

		const directories = await uploadedWorldDirectories(context, source);

		for (const directory of directories) {
			await inspectJavaWorld(context, directory);
		}

		const imported: WorldImport[] = [];

		for (const directory of directories) {
			const folder = nameOf(directory);
			const name = await freeWorldName(context, worldBaseName(folder));

			const sources = worldPaths(directory);
			const destinations = worldPaths(name);
			for (const [index, path] of sources.entries()) {
				const destination = destinations[index];
				if (destination && (await context.files.exists(path))) {
					await context.files.move(path, destination);
				}
			}

			imported.push({
				folder,
				name,
			});

			context.log("added a world", {
				folder,
				world: name,
			});
		}

		reportImported(context, imported);

		if (!directories.includes(source)) {
			await context.files.remove(source);
		}

		const notice = worldImportNotice(imported);

		return notice
			? {
					notice,
				}
			: undefined;
	},

	actions: {
		async export(context, row) {
			await exportWorld(context, row.id);
		},
		async clone(context, row, args) {
			const name = worldNameArgument(args.name);

			await cloneWorld(context, row.id, name);

			context.activity.report({
				name: BridgeEventName.WorldCloned,
				text: {
					ar: `تم نسخ ماب ${row.id} باسم ${name}`,
					en: `Cloned world ${row.id} as ${name}`,
				},
				subject: name,
				details: {
					world: name,
					source: row.id,
				},
			});
		},
		async activate(context, row) {
			const previous = await activeWorld(context);

			if (previous === row.id) {
				throw new BridgeUserError({
					ar: "هذي الماب شغّالة أصلًا",
					en: "this world is already the active one",
				});
			}

			await setActiveWorld(context, row.id);

			context.log("switched the active world", {
				world: row.id,
			});

			context.activity.report({
				name: BridgeEventName.WorldActivated,
				text: {
					ar: `تم تفعيل ماب ${row.id} بدل ${previous}`,
					en: `Activated world ${row.id} in place of ${previous}`,
				},
				subject: row.id,
				details: {
					world: row.id,
					previous,
				},
			});
		},

		async delete(context, row) {
			await refuseActiveWorld(context, row.id);

			for (const path of worldPaths(row.id)) {
				await context.files.remove(path);
			}

			context.log("deleted a world", {
				world: row.id,
			});

			context.activity.report({
				name: BridgeEventName.WorldDeleted,
				text: {
					ar: `تم حذف ماب ${row.id}`,
					en: `Deleted world ${row.id}`,
				},
				subject: row.id,
				details: {
					world: row.id,
				},
			});
		},

		async resetNether(context, row) {
			const { nether } = worldDimensions(row.id, await installedLayout(context));

			await context.files.remove(nether);

			context.log("reset the nether", {
				world: row.id,
				path: nether,
			});

			reportWiped(context, row.id, "nether", {
				ar: `تم تصفير النذر في ماب ${row.id}`,
				en: `Reset the Nether of world ${row.id}`,
			});
		},

		async resetEnd(context, row) {
			const { end } = worldDimensions(row.id, await installedLayout(context));

			await context.files.remove(end);

			context.log("reset the end", {
				world: row.id,
				path: end,
			});

			reportWiped(context, row.id, "end", {
				ar: `تم تصفير الإند في ماب ${row.id}`,
				en: `Reset the End of world ${row.id}`,
			});
		},
	},
};
