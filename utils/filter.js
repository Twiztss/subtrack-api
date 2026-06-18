// Keys that query parameters are allowed to filter on.
const SUBSCRIPTION_FILTER_KEYS = new Set(['name', 'payment', 'currency', 'frequency', 'category']);
const CATEGORY_FILTER_KEYS = new Set(['name']);

/**
 * Escape a string so it is safe to use as a literal inside a RegExp.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a Mongoose filter from a plain key/value map.
 * Only keys present in `allowedKeys` are forwarded; any key or value containing
 * MongoDB operator syntax ($, .) is silently dropped to prevent NoSQL injection.
 */
export const createFilterQuery = (filters, allowedKeys = SUBSCRIPTION_FILTER_KEYS) => {
    const query = {};

    for (const [key, value] of Object.entries(filters)) {
        // Drop unknown fields and any key that looks like a Mongo operator
        if (!allowedKeys.has(key) || key.includes('$') || key.includes('.')) continue;

        const strValue = String(value);

        // Drop values that contain operator syntax
        if (strValue.includes('$')) continue;

        if (key === 'name') {
            query[key] = { $regex: escapeRegex(strValue), $options: 'i' };
        } else {
            query[key] = strValue;
        }
    }

    return query;
};

export const createCategoryFilterQuery = (filters) =>
    createFilterQuery(filters, CATEGORY_FILTER_KEYS);

export const createSortQuery = (sort) => {
    const sortQuery = {};
    if (sort) {
        const [field, order = 'asc'] = sort.split(':');
        // Only allow known sortable fields to prevent arbitrary key injection
        const SORTABLE_FIELDS = new Set(['name', 'price', 'renewalDate', 'startDate', 'createdAt', 'updatedAt']);
        if (SORTABLE_FIELDS.has(field)) {
            sortQuery[field] = order === 'desc' ? -1 : 1;
        }
    }
    if (Object.keys(sortQuery).length === 0) {
        sortQuery.createdAt = -1;
    }
    return sortQuery;
};
