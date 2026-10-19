import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize = 25,
  onPageChange,
}) {
  if (!totalPages || totalPages <= 1 || (totalItems !== undefined && totalItems <= pageSize)) {
    return null;
  }

  const pageNumbers = getPageNumbers(page, totalPages);
  const hasItemCount = totalItems !== undefined && totalItems !== null;
  const startRecord = hasItemCount ? (totalItems === 0 ? 0 : (page - 1) * pageSize + 1) : null;
  const endRecord = hasItemCount ? Math.min(page * pageSize, totalItems) : null;

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        {hasItemCount ? (
          <>
            Showing <span className="pagination-info-bold">{startRecord}–{endRecord}</span> of{' '}
            <span className="pagination-info-bold">{totalItems}</span> records
          </>
        ) : (
          <>
            Page <span className="pagination-info-bold">{page}</span> of{' '}
            <span className="pagination-info-bold">{totalPages}</span>
          </>
        )}
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        {pageNumbers.map((item, idx) => {
          if (item === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                &hellip;
              </span>
            );
          }
          const isCurrent = item === page;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`pagination-page-btn ${isCurrent ? 'active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="pagination-btn"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
