/**
 * Pure calculation utilities for Pagination.
 * Ensures arithmetic safety, preventing NaN, Infinity, and out-of-bounds indexing.
 */

export function calculatePaginationRange({
  page,
  currentPage,
  totalItems,
  total,
  totalPages,
  pageSize = 25,
  itemsPerPage,
}) {
  const rawPage = page !== undefined ? page : currentPage;
  const rawTotal = totalItems !== undefined ? totalItems : total;
  const rawPageSize = pageSize !== undefined ? pageSize : itemsPerPage;

  const validPageSize = Math.max(1, Math.floor(Number(rawPageSize) || 25));
  const hasItemCount = rawTotal !== undefined && rawTotal !== null;
  const validTotalItems = hasItemCount ? Math.max(0, Math.floor(Number(rawTotal) || 0)) : null;

  let validTotalPages;
  if (totalPages !== undefined && totalPages !== null) {
    validTotalPages = Math.max(1, Math.floor(Number(totalPages) || 1));
  } else if (hasItemCount) {
    validTotalPages = Math.max(1, Math.ceil(validTotalItems / validPageSize));
  } else {
    validTotalPages = 1;
  }

  const parsedPage = Math.floor(Number(rawPage) || 1);
  const activePage = Math.max(1, Math.min(parsedPage, validTotalPages));

  let startRecord = 0;
  let endRecord = 0;

  if (hasItemCount) {
    if (validTotalItems === 0) {
      startRecord = 0;
      endRecord = 0;
    } else {
      startRecord = (activePage - 1) * validPageSize + 1;
      endRecord = Math.min(activePage * validPageSize, validTotalItems);
      if (startRecord > validTotalItems) {
        startRecord = validTotalItems;
      }
    }
  }

  return {
    activePage,
    validTotalPages,
    validPageSize,
    validTotalItems,
    hasItemCount,
    startRecord,
    endRecord,
  };
}

export function getPageNumbers(currentPage, totalPages) {
  const safeCurrent = Math.max(1, Math.min(Math.floor(Number(currentPage) || 1), totalPages));
  const safeTotal = Math.max(1, Math.floor(Number(totalPages) || 1));

  if (safeTotal <= 7) {
    const pages = [];
    for (let i = 1; i <= safeTotal; i++) {
      pages.push(i);
    }
    return pages;
  }

  if (safeCurrent <= 4) {
    return [1, 2, 3, 4, 5, '...', safeTotal];
  }

  if (safeCurrent >= safeTotal - 3) {
    return [
      1,
      '...',
      safeTotal - 4,
      safeTotal - 3,
      safeTotal - 2,
      safeTotal - 1,
      safeTotal,
    ];
  }

  return [1, '...', safeCurrent - 1, safeCurrent, safeCurrent + 1, '...', safeTotal];
}
