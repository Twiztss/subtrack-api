/**
 * Parse and validate pagination parameters from the request query.
 * Returns { n_page, n_limit, skip }.
 */
export const parsePagination = (query) => {
    const n_page = Math.max(1, parseInt(query.page) || 1);
    const n_limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    const skip = (n_page - 1) * n_limit;
    return { n_page, n_limit, skip };
};
