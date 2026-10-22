import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaginationRange, getPageNumbers } from './pagination.js';

describe('Pagination Range Calculations', () => {
  test('Standard first page with 574 records and pageSize 20', () => {
    const res = calculatePaginationRange({
      page: 1,
      totalPages: 29,
      totalItems: 574,
      pageSize: 20,
    });
    assert.equal(res.activePage, 1);
    assert.equal(res.validTotalPages, 29);
    assert.equal(res.startRecord, 1);
    assert.equal(res.endRecord, 20);
    assert.equal(res.validTotalItems, 574);
  });

  test('Page 2 with 574 records and pageSize 20', () => {
    const res = calculatePaginationRange({
      page: 2,
      totalPages: 29,
      totalItems: 574,
      pageSize: 20,
    });
    assert.equal(res.activePage, 2);
    assert.equal(res.startRecord, 21);
    assert.equal(res.endRecord, 40);
  });

  test('Last page (29) with 574 records and pageSize 20', () => {
    const res = calculatePaginationRange({
      page: 29,
      totalPages: 29,
      totalItems: 574,
      pageSize: 20,
    });
    assert.equal(res.activePage, 29);
    assert.equal(res.startRecord, 561);
    assert.equal(res.endRecord, 574);
  });

  test('Single full page with exactly 20 records', () => {
    const res = calculatePaginationRange({
      page: 1,
      totalPages: 1,
      totalItems: 20,
      pageSize: 20,
    });
    assert.equal(res.activePage, 1);
    assert.equal(res.validTotalPages, 1);
    assert.equal(res.startRecord, 1);
    assert.equal(res.endRecord, 20);
  });

  test('Single partial page with 7 records', () => {
    const res = calculatePaginationRange({
      page: 1,
      totalPages: 1,
      totalItems: 7,
      pageSize: 20,
    });
    assert.equal(res.activePage, 1);
    assert.equal(res.validTotalPages, 1);
    assert.equal(res.startRecord, 1);
    assert.equal(res.endRecord, 7);
  });

  test('Zero records in dataset', () => {
    const res = calculatePaginationRange({
      page: 1,
      totalPages: 1,
      totalItems: 0,
      pageSize: 20,
    });
    assert.equal(res.activePage, 1);
    assert.equal(res.startRecord, 0);
    assert.equal(res.endRecord, 0);
    assert.equal(res.validTotalItems, 0);
  });

  test('Backwards-compatible support for currentPage prop', () => {
    const res = calculatePaginationRange({
      currentPage: 5,
      totalPages: 10,
      totalItems: 100,
      pageSize: 10,
    });
    assert.equal(res.activePage, 5);
    assert.equal(res.startRecord, 41);
    assert.equal(res.endRecord, 50);
  });

  test('Defensive handling of undefined/NaN inputs', () => {
    const res = calculatePaginationRange({
      page: undefined,
      currentPage: undefined,
      totalPages: undefined,
      totalItems: 574,
      pageSize: 20,
    });
    assert.equal(Number.isNaN(res.activePage), false);
    assert.equal(Number.isNaN(res.startRecord), false);
    assert.equal(Number.isNaN(res.endRecord), false);
    assert.equal(res.activePage, 1);
    assert.equal(res.validTotalPages, 29);
    assert.equal(res.startRecord, 1);
    assert.equal(res.endRecord, 20);
  });

  test('Clamping when page exceeds total pages', () => {
    const res = calculatePaginationRange({
      page: 50,
      totalPages: 5,
      totalItems: 100,
      pageSize: 20,
    });
    assert.equal(res.activePage, 5);
    assert.equal(res.startRecord, 81);
    assert.equal(res.endRecord, 100);
  });

  test('Defensive handling of zero pageSize', () => {
    const res = calculatePaginationRange({
      page: 1,
      totalItems: 50,
      pageSize: 0,
    });
    assert.equal(res.validPageSize >= 1, true);
    assert.equal(Number.isNaN(res.validTotalPages), false);
  });
});

describe('Page Numbers Generation', () => {
  test('Under 7 pages generates continuous integers', () => {
    const pages = getPageNumbers(2, 5);
    assert.deepEqual(pages, [1, 2, 3, 4, 5]);
  });

  test('Page 1 of 29 pages generates starting ellipsis', () => {
    const pages = getPageNumbers(1, 29);
    assert.deepEqual(pages, [1, 2, 3, 4, 5, '...', 29]);
  });

  test('Middle page of 29 pages generates two ellipses', () => {
    const pages = getPageNumbers(15, 29);
    assert.deepEqual(pages, [1, '...', 14, 15, 16, '...', 29]);
  });

  test('End page of 29 pages generates trailing numbers', () => {
    const pages = getPageNumbers(28, 29);
    assert.deepEqual(pages, [1, '...', 25, 26, 27, 28, 29]);
  });

  test('Invalid page or totalPages never produces NaN in array', () => {
    const pages = getPageNumbers(undefined, 29);
    assert.equal(pages.some((item) => Number.isNaN(item)), false);
    assert.equal(pages[0], 1);
    assert.equal(pages[pages.length - 1], 29);
  });
});
