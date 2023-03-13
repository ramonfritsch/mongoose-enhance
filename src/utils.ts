export function ensureArray<T>(items: T[] | T | null): T[] {
	if (!items) {
		return [];
	}

	if (!Array.isArray(items)) {
		items = [items];
	}

	return items;
}
