export const createFilterQuery = (filters) => {
    const query = {};

    if (Object.entries(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
            if (key === 'name') {
                query[key] = { $regex: value, $options: 'i' };
            } else {
                query[key] = value;
            }
        }
    }

    return query;
}

export const createSortQuery = (sort) => {
    const sortQuery = {};
    if (sort) {
        const [field, order = 'asc'] = sort.split(':');  // Default to 'asc'
        sortQuery[field] = order === 'desc' ? -1 : 1;    // Changed logic
    } else {
        sortQuery.createdAt = -1;  // Default: newest first
    }
    return sortQuery;
} 