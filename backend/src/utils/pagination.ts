export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function getPagination(pageInput: any, limitInput: any): PaginationParams {
  const page = Math.max(1, Number(pageInput) || 1);
  const requestedLimit = Number(limitInput) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
