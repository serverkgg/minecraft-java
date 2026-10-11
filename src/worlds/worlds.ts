import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { installedLayout } from "../install/installLayout";
import { formatByteSize, isUnder, relativeUploadPath, WORLD_STAGING } from "../shared";
import { readWorldHardcore, setWorldHardcore } from "./levelDat";
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
			ar: "لا يحتوي الملف المضغوط على level.dat، تأكد من ضغط مجلد الماب نفسه",
			en: "The archive has no level.dat. Make sure you zipped the world folder itself",
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

const ACTIVE_WORLD_DELETE: Bridge.Text = {
	ar: "لا يمكن حذف الماب المفعّل، فعّل مابًا آخر أولًا",
	en: "You can't delete the active world. Activate another one first",
};

const ACTIVE_WORLD_ACTIVATE: Bridge.Text = {
	ar: "هذا الماب مفعّل مسبقًا",
	en: "This world is already the active one",
};

const HARDCORE_ALREADY_ON: Bridge.Text = {
	ar: "الهاردكور مفعّل مسبقًا في هذا الماب.",
	en: "Hardcore is already on for this world.",
};

const HARDCORE_ALREADY_OFF: Bridge.Text = {
	ar: "الهاردكور موقوف مسبقًا في هذا الماب.",
	en: "Hardcore is already off for this world.",
};

const listedWorld = async (context: Bridge.Context, id: string) => {
	if (!(await discoverWorlds(context)).includes(id)) {
		throw new BridgeUserError({
			ar: "تعذّر العثور على الماب. حدّث القائمة وجرب مرة ثانية.",
			en: "We couldn't find that world. Refresh the list and try again.",
		});
	}

	return id;
};

const refuseActiveWorld = async (context: Bridge.Context, name: string) => {
	if ((await activeWorld(context)) !== name) {
		return;
	}

	throw new BridgeUserError(ACTIVE_WORLD_DELETE);
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
				hardcore: (await readWorldHardcore(context, name)) === true ? ACTIVE_MARK : "",
				path: `.serverk-exports/${name}.zip`,
			});
		}

		return rows;
	},

	async add(context, input) {
		const source = relativeUploadPath(input);

		if (source === null || !isUnder(source, WORLD_STAGING) || !(await context.files.exists(source))) {
			throw new BridgeUserError({
				ar: "تعذّر العثور على الملفات المرفوعة",
				en: "We couldn't find the uploaded files",
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
				throw new BridgeUserError(ACTIVE_WORLD_ACTIVATE);
			}

			await setActiveWorld(context, row.id);

			context.log("switched the active world", {
				world: row.id,
			});

			context.activity.report({
				name: BridgeEventName.WorldActivated,
				text: {
					ar: `تم تفعيل ماب ${row.id} بدلًا من ${previous}`,
					en: `Activated world ${row.id} in place of ${previous}`,
				},
				subject: row.id,
				details: {
					world: row.id,
					previous,
				},
			});
		},

		async hardcore(context, row, args) {
			const world = await listedWorld(context, row.id);
			const enabled = args.enabled === true;

			if (!(await setWorldHardcore(context, world, enabled))) {
				throw new BridgeUserError(enabled ? HARDCORE_ALREADY_ON : HARDCORE_ALREADY_OFF);
			}

			context.activity.report({
				name: BridgeEventName.GameplayChanged,
				text: enabled
					? {
							ar: `تم تفعيل الهاردكور في ماب ${world}`,
							en: `Turned on hardcore for world ${world}`,
						}
					: {
							ar: `تم إيقاف الهاردكور في ماب ${world}`,
							en: `Turned off hardcore for world ${world}`,
						},
				subject: world,
				details: {
					what: "hardcore",
					value: enabled ? "on" : "off",
					world,
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
				ar: `تم ريسيت النذر في ماب ${row.id}`,
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
				ar: `تم ريسيت الإند في ماب ${row.id}`,
				en: `Reset the End of world ${row.id}`,
			});
		},
	},

	async unavailable(_context, row): Promise<Bridge.Unavailable> {
		if (row.active !== ACTIVE_MARK) {
			return {};
		}

		return {
			delete: ACTIVE_WORLD_DELETE,
			activate: ACTIVE_WORLD_ACTIVATE,
		};
	},
};
