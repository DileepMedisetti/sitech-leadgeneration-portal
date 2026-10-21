import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { calculatePaginationRange, getPageNumbers } from '../../utils/pagination';

export default function Pagination({
  page,
  currentPage,
  totalPages,
  totalItems,
  total,
  pageSize = 25,
  itemsPerPage,
  onPageChange,
}) {
  const {
    activePage,
    validTotalPages,
    validTotalItems,
    hasItemCount,
    startRecord,
    endRecord,
  } = calculatePaginationRange({
    page,
    currentPage,
    totalItems,
    total,
    totalPages,
    pageSize,
    itemsPerPage,
  });

  const pageNumbers = getPageNumbers(activePage, validTotalPages);

  return (
    <div className="pagination-container" role="navigation" aria-label="Pagination Navigation">
      <div className="pagination-info">
        {hasItemCount ? (
          <>
            Showing <span className="pagination-info-bold">{startRecord}–{endRecord}</span> of{' '}
            <span className="pagination-info-bold">{validTotalItems}</span> records
          </>
        ) : (
          <>
            Page <span className="pagination-info-bold">{activePage}</span> of{' '}
            <span className="pagination-info-bold">{validTotalPages}</span>
          </>
        )}
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(activePage - 1)}
          disabled={activePage <= 1}
          className="pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        {pageNumbers.map((item, idx) => {
          if (item === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis" aria-hidden="true">
                &hellip;
              </span>
            );
          }
          const isCurrent = item === activePage;
          return (
            <button
              key={`page-${item}`}
              type="button"
              onClick={() => onPageChange && onPageChange(item)}
              className={`pagination-page-btn ${isCurrent ? 'active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={`Page ${item}`}
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange && onPageChange(activePage + 1)}
          disabled={activePage >= validTotalPages}
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
