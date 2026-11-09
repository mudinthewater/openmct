/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2024, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/
import { EventEmitter } from 'eventemitter3';
import _ from 'lodash';

import { ORDER } from '../constants.js';

/**
 * @typedef {import('.TelemetryTableRow.js').default} TelemetryTableRow
 */

/**
 * @constructor
 */
export default class TableRowCollection extends EventEmitter {
  constructor() {
    super();

    this.rows = [];
    this.columnFilters = {};
    this.retainedMarkedRows = [];
    this.addRows = this.addRows.bind(this);
    this.removeRowsByObject = this.removeRowsByObject.bind(this);
    this.removeRowsByData = this.removeRowsByData.bind(this);

    this.clear = this.clear.bind(this);
  }

  removeRowsByObject(keyString) {
    let removed = [];

    this.rows = this.rows.filter((row) => {
      if (row.objectKeyString === keyString) {
        removed.push(row);

        return false;
      } else {
        return true;
      }
    });

    this.emit('remove', removed);
  }

  addRows(rows) {
    let rowsToAdd = this.filterRows(rows);

    this.sortAndMergeRows(rowsToAdd);

    // we emit filter no matter what to trigger
    // an update of visible rows
    if (rowsToAdd.length > 0) {
      this.emit('add', rowsToAdd);
    }
  }

  clearRowsFromTableAndFilter(rows) {
    this.retainMarkedRows();

    let rowsToAdd = this.filterRows(rows);
    // Reset of all rows, need to wipe current rows
    this.rows = [];

    this.sortAndMergeRows(rowsToAdd);
    this.applyRetainedMarks();

    // We emit filter and update of visible rows
    this.emit('filter', rowsToAdd);
  }

  /**
   * Remember the identity of currently marked rows so marks can be
   * reapplied after filtering rebuilds the row objects. Datum content
   * alone cannot identify a row: repeated events can share an identical
   * datum, so the retained identity also carries the underlying datum
   * object and the row's occurrence among its identical siblings.
   * @private
   */
  retainMarkedRows() {
    this.pruneRetainedMarkedRows();

    this.rows.forEach((row, index) => {
      if (!row.marked) {
        return;
      }

      const occurrence = this.rows
        .slice(0, index)
        .filter(
          (other) =>
            other.objectKeyString === row.objectKeyString && _.isEqual(other.datum, row.datum)
        ).length;

      const alreadyRetained = this.retainedMarkedRows.some((retained) => {
        if (
          retained.objectKeyString !== row.objectKeyString ||
          !_.isEqual(retained.datum, row.datum)
        ) {
          return false;
        }

        if (retained.fullDatum !== undefined && row.fullDatum !== undefined) {
          return retained.fullDatum === row.fullDatum;
        }

        return retained.occurrence === occurrence;
      });

      if (!alreadyRetained) {
        this.retainedMarkedRows.push({
          objectKeyString: row.objectKeyString,
          datum: { ...row.datum },
          fullDatum: row.fullDatum,
          occurrence
        });
      }
    });
  }

  /**
   * Drop retained entries whose row is back in the collection but no
   * longer marked (e.g. the user unselected all rows after a filter
   * cycle). Entries whose row is currently filtered out cannot be
   * judged and are kept.
   * @private
   */
  pruneRetainedMarkedRows() {
    this.retainedMarkedRows = this.retainedMarkedRows.filter((retained) => {
      const matches = this.rows.filter(
        (row) =>
          row.objectKeyString === retained.objectKeyString && _.isEqual(row.datum, retained.datum)
      );

      if (matches.length === 0) {
        return true;
      }

      const byFullDatum =
        retained.fullDatum !== undefined
          ? matches.find((row) => row.fullDatum === retained.fullDatum)
          : undefined;
      const candidate =
        byFullDatum ?? matches[Math.min(retained.occurrence ?? 0, matches.length - 1)];

      return candidate.marked === true;
    });
  }

  /**
   * Reapply retained marks to rebuilt rows, marking exactly one rebuilt
   * row per retained row: the row built from the same underlying datum
   * when it can be told apart, otherwise the same occurrence among
   * datum-identical siblings. Then refresh the retained set from the
   * live marked rows.
   * @private
   */
  applyRetainedMarks() {
    if (this.retainedMarkedRows.length === 0) {
      return;
    }

    const claimedRowIndexes = new Set();

    this.retainedMarkedRows.forEach((retained) => {
      const candidateIndexes = [];

      this.rows.forEach((row, index) => {
        if (
          !claimedRowIndexes.has(index) &&
          row.objectKeyString === retained.objectKeyString &&
          _.isEqual(retained.datum, row.datum)
        ) {
          candidateIndexes.push(index);
        }
      });

      if (candidateIndexes.length === 0) {
        return;
      }

      let chosenIndex = candidateIndexes.find(
        (index) =>
          retained.fullDatum !== undefined && this.rows[index].fullDatum === retained.fullDatum
      );

      if (chosenIndex === undefined) {
        const occurrence = Math.min(retained.occurrence ?? 0, candidateIndexes.length - 1);
        chosenIndex = candidateIndexes[occurrence];
      }

      claimedRowIndexes.add(chosenIndex);
      this.rows[chosenIndex].marked = true;
    });

    this.retainedMarkedRows = [];
    this.retainMarkedRows();
  }

  filterRows(rows) {
    if (Object.keys(this.columnFilters).length > 0) {
      return rows.filter(this.matchesFilters, this);
    }

    return rows;
  }

  sortAndMergeRows(rows) {
    const sortedRows = this.sortCollection(rows);

    if (this.rows.length === 0) {
      this.rows = sortedRows;

      return;
    }

    const firstIncomingRow = sortedRows[0];
    const lastIncomingRow = sortedRows[sortedRows.length - 1];
    const firstExistingRow = this.rows[0];
    const lastExistingRow = this.rows[this.rows.length - 1];

    if (this.firstRowInSortOrder(lastIncomingRow, firstExistingRow) === lastIncomingRow) {
      this.insertOrUpdateRows(sortedRows, true);
    } else if (this.firstRowInSortOrder(lastExistingRow, firstIncomingRow) === lastExistingRow) {
      this.insertOrUpdateRows(sortedRows, false);
    } else {
      this.mergeSortedRows(sortedRows);
    }
  }

  getInPlaceUpdateIndex(row) {
    const inPlaceUpdateKey = row.inPlaceUpdateKey;
    if (!inPlaceUpdateKey) {
      return -1;
    }

    const foundIndex = this.rows.findIndex(
      (existingRow) =>
        existingRow.datum[inPlaceUpdateKey] &&
        existingRow.datum[inPlaceUpdateKey] === row.datum[inPlaceUpdateKey]
    );

    return foundIndex;
  }

  /**
   * `incomingRow` exists in the collection,
   * so merge existing and incoming row properties
   *
   * Do to reactivity of Vue, we want to replace the existing row with the updated row
   * @param {TelemetryTableRow} incomingRow to update
   * @param {number} index of the existing row in the collection to update
   */
  updateRowInPlace(incomingRow, index) {
    // Update the incoming row, not the existing row
    const existingRow = this.rows[index];
    incomingRow.updateWithDatum(existingRow);

    // Replacing the existing row with the updated, incoming row will trigger Vue reactivity
    // because the reference to the row has changed
    this.rows.splice(index, 1, incomingRow);
  }

  setLimit(rowLimit) {
    this.rowLimit = rowLimit;
  }

  removeLimit() {
    this.rowLimit = null;
    delete this.rowLimit;
  }

  sortCollection(rows) {
    const sortedRows = _.orderBy(
      rows,
      (row) => row.getParsedValue(this.sortOptions.key),
      this.sortOptions.direction
    );

    return sortedRows;
  }

  insertOrUpdateRows(rowsToAdd, addToBeginning) {
    rowsToAdd.forEach((row, addRowsIndex) => {
      const index = this.getInPlaceUpdateIndex(row);
      if (index > -1) {
        this.updateRowInPlace(row, index);
      } else {
        if (addToBeginning) {
          this.rows.splice(addRowsIndex, 0, row);
        } else {
          this.rows.push(row);
        }
      }
    });
  }

  mergeSortedRows(incomingRows) {
    const mergedRows = [];
    let existingRowIndex = 0;
    let incomingRowIndex = 0;

    while (existingRowIndex < this.rows.length && incomingRowIndex < incomingRows.length) {
      const existingRow = this.rows[existingRowIndex];
      const incomingRow = incomingRows[incomingRowIndex];

      const inPlaceIndex = this.getInPlaceUpdateIndex(incomingRow);
      if (inPlaceIndex > -1) {
        this.updateRowInPlace(incomingRow, inPlaceIndex);
        incomingRowIndex++;
      } else {
        if (this.firstRowInSortOrder(existingRow, incomingRow) === existingRow) {
          mergedRows.push(existingRow);
          existingRowIndex++;
        } else {
          mergedRows.push(incomingRow);
          incomingRowIndex++;
        }
      }
    }

    // tail of existing rows is all that is left to merge
    if (existingRowIndex < this.rows.length) {
      for (existingRowIndex; existingRowIndex < this.rows.length; existingRowIndex++) {
        mergedRows.push(this.rows[existingRowIndex]);
      }
    }

    // tail of incoming rows is all that is left to merge
    if (incomingRowIndex < incomingRows.length) {
      for (incomingRowIndex; incomingRowIndex < incomingRows.length; incomingRowIndex++) {
        mergedRows.push(incomingRows[incomingRowIndex]);
      }
    }

    this.rows = mergedRows;
  }

  firstRowInSortOrder(row1, row2) {
    const val1 = this.getValueForSortColumn(row1);
    const val2 = this.getValueForSortColumn(row2);

    if (this.sortOptions.direction === ORDER.ASCENDING) {
      return val1 <= val2 ? row1 : row2;
    } else {
      return val1 >= val2 ? row1 : row2;
    }
  }

  removeRowsByData(data) {
    let removed = [];

    this.rows = this.rows.filter((row) => {
      if (data.includes(row.fullDatum)) {
        removed.push(row);

        return false;
      } else {
        return true;
      }
    });

    this.emit('remove', removed);
  }

  /**
   * Sorts the telemetry collection based on the provided sort field
   * specifier. Subsequent inserts are sorted to maintain specified sport
   * order.
   *
   * @example
   * // First build some mock telemetry for the purpose of an example
   * let now = Date.now();
   * let telemetry = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (value) {
   *     return {
   *         // define an object property to demonstrate nested paths
   *         timestamp: {
   *             ms: now - value * 1000,
   *             text:
   *         },
   *         value: value
   *     }
   * });
   * let collection = new TelemetryCollection();
   *
   * collection.add(telemetry);
   *
   * // Sort by telemetry value
   * collection.sortBy({
   *  key: 'value', direction: 'asc'
   * });
   *
   * // Sort by ms since epoch
   * collection.sort({
   *  key: 'timestamp.ms',
   *  direction: 'asc'
   * });
   *
   * // Sort by 'text' attribute, descending
   * collection.sort("timestamp.text");
   *
   *
   * @param {Object} sortOptions An object specifying a sort key, and direction.
   */
  sortBy(sortOptions) {
    if (arguments.length > 0) {
      this.setSortOptions(sortOptions);
      this.rows = _.orderBy(
        this.rows,
        (row) => row.getParsedValue(sortOptions.key),
        sortOptions.direction
      );
      this.emit('sort');
    }

    // Return duplicate to avoid direct modification of underlying object
    return Object.assign({}, this.sortOptions);
  }

  setSortOptions(sortOptions) {
    this.sortOptions = sortOptions;
  }

  setColumnFilter(columnKey, filter) {
    this.retainMarkedRows();

    filter = filter.trim().toLowerCase();
    let wasBlank = this.columnFilters[columnKey] === undefined;
    let isSubset = this.isSubsetOfCurrentFilter(columnKey, filter);

    if (filter.length === 0) {
      delete this.columnFilters[columnKey];
    } else {
      this.columnFilters[columnKey] = filter;
    }

    if (isSubset || wasBlank) {
      this.rows = this.rows.filter(this.matchesFilters, this);
      this.emit('filter');
    } else {
      this.emit('resetRowsFromAllData');
    }
  }

  setColumnRegexFilter(columnKey, filter) {
    this.retainMarkedRows();

    filter = filter.trim();
    this.columnFilters[columnKey] = new RegExp(filter);

    this.emit('resetRowsFromAllData');
  }

  getColumnMapForObject(objectKeyString) {
    let columns = this.configuration.getColumns();

    if (columns[objectKeyString]) {
      return columns[objectKeyString].reduce((map, column) => {
        map[column.getKey()] = column;

        return map;
      }, {});
    }

    return {};
  }

  // /**
  //  * @private
  //  */
  isSubsetOfCurrentFilter(columnKey, filter) {
    if (this.columnFilters[columnKey] instanceof RegExp) {
      return false;
    }

    return (
      this.columnFilters[columnKey] &&
      filter.startsWith(this.columnFilters[columnKey]) &&
      // startsWith check will otherwise fail when filter cleared
      // because anyString.startsWith('') === true
      filter !== ''
    );
  }

  /**
   * @private
   */
  matchesFilters(row) {
    let doesMatchFilters = true;
    Object.keys(this.columnFilters).forEach((key) => {
      if (!doesMatchFilters || !this.rowHasColumn(row, key)) {
        return false;
      }

      let formattedValue = row.getFormattedValue(key);
      if (formattedValue === undefined) {
        return false;
      }

      if (this.columnFilters[key] instanceof RegExp) {
        doesMatchFilters = this.columnFilters[key].test(formattedValue);
      } else {
        doesMatchFilters = formattedValue.toLowerCase().indexOf(this.columnFilters[key]) !== -1;
      }
    });

    return doesMatchFilters;
  }

  rowHasColumn(row, key) {
    return Object.prototype.hasOwnProperty.call(row.columns, key);
  }

  getRows() {
    if (this.rowLimit && this.rows.length > this.rowLimit) {
      if (this.sortOptions.direction === ORDER.DESCENDING) {
        return this.rows.slice(0, this.rowLimit);
      } else {
        return this.rows.slice(-this.rowLimit);
      }
    }

    return this.rows;
  }

  getRowsLength() {
    if (this.rowLimit && this.rows.length > this.rowLimit) {
      return this.rowLimit;
    }

    return this.rows.length;
  }

  getValueForSortColumn(row) {
    return row.getParsedValue(this.sortOptions.key);
  }

  clear() {
    let removedRows = this.rows;
    this.rows = [];
    this.retainedMarkedRows = [];

    this.emit('remove', removedRows);
  }

  destroy() {
    this.removeAllListeners();
  }
}
