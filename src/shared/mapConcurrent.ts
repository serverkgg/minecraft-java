export const mapConcurrent = async <Item>(
	items: Item[],
	limit: number,
	run: (item: Item, index: number) => Promise<void>,
) => {
	const width = Math.max(1, Math.min(limit, items.length));
	let cursor = 0;
	let failed = false;
	let failure: unknown;

	const worker = async () => {
		while (cursor < items.length && !failed) {
			const index = cursor;

			cursor += 1;

			const item = items[index];

			if (item === undefined) {
				continue;
			}

			try {
				await run(item, index);
			} catch (error) {
				if (!failed) {
					failed = true;
					failure = error;
				}
			}
		}
	};

	await Promise.all(
		Array.from(
			{
				length: width,
			},
			worker,
		),
	);

	if (failed) {
		throw failure;
	}
};
