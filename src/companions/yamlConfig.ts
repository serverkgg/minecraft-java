export type YamlValue = boolean | number | string | string[];

export interface YamlEntry {
	path: string[];
	value: YamlValue;
}

interface YamlKeyLine {
	index: number;
	indent: number;
	path: string[];
}

const KEY_PATTERN = /^(\s*)([A-Za-z0-9_][A-Za-z0-9_.+-]*):(\s|$)(.*)$/;

const LIST_PATTERN = /^\s*-(\s|$)/;

const COMMENT_PATTERN = /^\s*(#|$)/;

const INDENT_STEP = "  ";

const scalarOf = (value: YamlValue) => {
	if (Array.isArray(value)) {
		return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	if (typeof value === "number") {
		return String(value);
	}

	return JSON.stringify(value);
};

const indentOf = (line: string) => {
	return line.length - line.trimStart().length;
};

const samePath = (left: string[], right: string[]) => {
	return left.length === right.length && left.every((segment, index) => segment === right[index]);
};

const keyLinesOf = (lines: string[]): YamlKeyLine[] => {
	const found: YamlKeyLine[] = [];
	const stack: YamlKeyLine[] = [];

	let listIndent: number | null = null;

	for (const [index, line] of lines.entries()) {
		if (COMMENT_PATTERN.test(line)) {
			continue;
		}

		const indent = indentOf(line);

		if (listIndent !== null && indent > listIndent) {
			continue;
		}

		listIndent = null;

		if (LIST_PATTERN.test(line)) {
			listIndent = indent;

			continue;
		}

		const match = line.match(KEY_PATTERN);

		if (!match?.[2]) {
			continue;
		}

		while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) {
			stack.pop();
		}

		const entry: YamlKeyLine = {
			index,
			indent,
			path: [
				...(stack.at(-1)?.path ?? []),
				match[2],
			],
		};

		found.push(entry);
		stack.push(entry);
	}

	return found;
};

const blockEnd = (lines: string[], node: YamlKeyLine) => {
	let last = node.index;

	for (let index = node.index + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";

		if (COMMENT_PATTERN.test(line)) {
			continue;
		}

		if (indentOf(line) <= node.indent) {
			break;
		}

		last = index;
	}

	return last;
};

const childIndentOf = (keyLines: YamlKeyLine[], node: YamlKeyLine) => {
	const child = keyLines.find((candidate) => {
		return candidate.path.length === node.path.length + 1 && samePath(candidate.path.slice(0, -1), node.path);
	});

	return child ? " ".repeat(child.indent) : `${" ".repeat(node.indent)}${INDENT_STEP}`;
};

const blockValueLength = (lines: string[], node: YamlKeyLine) => {
	let length = 0;

	for (let index = node.index + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";

		if (COMMENT_PATTERN.test(line)) {
			break;
		}

		const indent = indentOf(line);

		if (indent < node.indent || (indent === node.indent && !LIST_PATTERN.test(line))) {
			break;
		}

		length += 1;
	}

	return length;
};

const rewrite = (line: string, value: YamlValue) => {
	const match = line.match(KEY_PATTERN);

	if (!match?.[2]) {
		return line;
	}

	const rest = match[4] ?? "";
	const comment = rest.startsWith('"') || rest.startsWith("'") ? "" : (rest.match(/\s+#.*$/)?.[0] ?? "");

	return `${match[1] ?? ""}${match[2]}: ${scalarOf(value)}${comment}`;
};

const applyEntry = (lines: string[], entry: YamlEntry) => {
	const keyLines = keyLinesOf(lines);
	const existing = keyLines.find((candidate) => samePath(candidate.path, entry.path));

	if (existing) {
		lines.splice(
			existing.index,
			blockValueLength(lines, existing) + 1,
			rewrite(lines[existing.index] ?? "", entry.value),
		);

		return;
	}

	let depth = entry.path.length - 1;

	while (depth > 0) {
		const parent = keyLines.find((candidate) => samePath(candidate.path, entry.path.slice(0, depth)));

		if (parent) {
			const indent = childIndentOf(keyLines, parent);
			const trailing = entry.path.slice(depth, -1);
			const inserted = [
				...trailing.map((segment, offset) => `${indent}${INDENT_STEP.repeat(offset)}${segment}:`),
				`${indent}${INDENT_STEP.repeat(trailing.length)}${entry.path.at(-1)}: ${scalarOf(entry.value)}`,
			];

			lines.splice(blockEnd(lines, parent) + 1, 0, ...inserted);

			return;
		}

		depth -= 1;
	}

	const branch = entry.path.slice(0, -1).map((segment, offset) => `${INDENT_STEP.repeat(offset)}${segment}:`);

	if (lines.length > 0 && (lines.at(-1) ?? "").trim().length > 0) {
		lines.push("");
	}

	lines.push(...branch, `${INDENT_STEP.repeat(branch.length)}${entry.path.at(-1)}: ${scalarOf(entry.value)}`);
};

export const mergeYaml = (source: string, entries: YamlEntry[]) => {
	const lines = source.length > 0 ? source.split("\n") : [];

	for (const entry of entries) {
		applyEntry(lines, entry);
	}

	const body = lines.join("\n");

	return body.endsWith("\n") ? body : `${body}\n`;
};
