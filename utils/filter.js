export const createFilterQuery = (filters) => {
    // Add query Object
    const query = {};

    // Create search query if there's any 
    if (Object.entries(filters > 0)) {
        // Dynamically build query from req.query
        for (const [key, value] of Object.entries(filters)) {
            if (key === 'name') {
                query[key] = { $regex: value, $options: 'i' }; // Case-insensitive partial match
            } else if (key === 'limit') {
                limit === Number(value);
            } else {
                query[key] = value; // Exact match for other fields
            }
        }
    }

    return query;
}