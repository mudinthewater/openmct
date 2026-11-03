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

import { ORDER } from '../constants.js';
import TableRowCollection from './TableRowCollection.js';

describe('TableRowCollection marked row retention', () => {
  let collection;

  function fakeRow(value, marked = false) {
    return {
      objectKeyString: 'test-object',
      datum: { utc: value, 'some-key': `value-${value}` },
      fullDatum: { utc: value, 'some-key': `value-${value}` },
      columns: { utc: {}, 'some-key': {} },
      marked,
      getFormattedValue(key) {
        return String(this.datum[key]);
      },
      getParsedValue(key) {
        return this.datum[key];
      }
    };
  }

  // Rows whose datum content is identical (e.g. a repeated EVR) but which
  // are distinct telemetry deliveries, told apart only by fullDatum.
  function fakeIdenticalRow(id, marked = false) {
    const row = fakeRow(1, marked);
    row.fullDatum = { delivery: id };

    return row;
  }

  beforeEach(() => {
    collection = new TableRowCollection();
    collection.setSortOptions({ key: 'utc', direction: ORDER.ASCENDING });
  });

  it('retains marks on rows rebuilt after filter is cleared', () => {
    collection.addRows([fakeRow(1, true), fakeRow(2)]);

    // Narrowing drops the marked row from the collection.
    collection.setColumnFilter('some-key', 'value-2');
    expect(collection.getRows().length).toBe(1);

    // Clearing the filter then rebuilds row objects from all data
    // (the resetRowsFromAllData path in TelemetryTable).
    collection.setColumnFilter('some-key', '');
    const rebuiltMarked = fakeRow(1);
    const rebuiltOther = fakeRow(2);
    collection.clearRowsFromTableAndFilter([rebuiltMarked, rebuiltOther]);

    expect(rebuiltMarked.marked).toBe(true);
    expect(rebuiltOther.marked).toBeFalsy();
  });

  it('retains marks across a regex filter reset', () => {
    collection.addRows([fakeRow(1, true), fakeRow(2)]);

    collection.setColumnRegexFilter('some-key', 'value-2');
    collection.setColumnFilter('some-key', '');

    const rebuiltMarked = fakeRow(1);
    collection.clearRowsFromTableAndFilter([rebuiltMarked, fakeRow(2)]);

    expect(rebuiltMarked.marked).toBe(true);
  });

  it('does not mark rebuilt rows whose datum does not match', () => {
    collection.addRows([fakeRow(1, true)]);

    collection.setColumnRegexFilter('some-key', 'value-2');
    collection.setColumnFilter('some-key', '');

    const rebuiltDifferent = fakeRow(9);
    collection.clearRowsFromTableAndFilter([rebuiltDifferent]);

    expect(rebuiltDifferent.marked).toBeFalsy();
  });

  it('marks only the retained occurrence when rebuilt rows share an identical datum', () => {
    collection.addRows([fakeIdenticalRow('a'), fakeIdenticalRow('b', true), fakeIdenticalRow('c')]);

    // Narrowing drops every identical row from the collection.
    collection.setColumnFilter('some-key', 'no-match');
    expect(collection.getRows().length).toBe(0);

    // Rebuilt rows are new deliveries, so only occurrence position can
    // tell the marked copy from its identical siblings.
    collection.setColumnFilter('some-key', '');
    const rebuilt = [fakeIdenticalRow('x'), fakeIdenticalRow('y'), fakeIdenticalRow('z')];
    collection.clearRowsFromTableAndFilter(rebuilt);

    expect(rebuilt.map((row) => Boolean(row.marked))).toEqual([false, true, false]);
  });

  it('marks the exact retained delivery when rebuilt rows share an identical datum', () => {
    const markedRow = fakeIdenticalRow('b', true);
    collection.addRows([fakeIdenticalRow('a'), markedRow, fakeIdenticalRow('c')]);

    collection.setColumnFilter('some-key', 'no-match');
    collection.setColumnFilter('some-key', '');

    // Same deliveries in a different order: the mark follows the delivery.
    const rebuilt = [fakeIdenticalRow('c'), fakeIdenticalRow('a'), fakeIdenticalRow('b')];
    rebuilt[2].fullDatum = markedRow.fullDatum;
    collection.clearRowsFromTableAndFilter(rebuilt);

    expect(rebuilt.map((row) => Boolean(row.marked))).toEqual([false, false, true]);
  });

  it('retains every marked occurrence of an identical datum', () => {
    collection.addRows([
      fakeIdenticalRow('a', true),
      fakeIdenticalRow('b'),
      fakeIdenticalRow('c', true)
    ]);

    collection.setColumnFilter('some-key', 'no-match');
    collection.setColumnFilter('some-key', '');

    const rebuilt = [fakeIdenticalRow('x'), fakeIdenticalRow('y'), fakeIdenticalRow('z')];
    collection.clearRowsFromTableAndFilter(rebuilt);

    expect(rebuilt.map((row) => Boolean(row.marked))).toEqual([true, false, true]);
  });

  it('does not resurrect a row that was unmarked before the next filter cycle', () => {
    collection.addRows([fakeRow(1, true), fakeRow(2), fakeRow(3)]);

    // First cycle: narrow, then clear and rebuild; row 1 stays marked.
    collection.setColumnFilter('some-key', 'value-2');
    collection.setColumnFilter('some-key', '');
    let rebuilt = [fakeRow(1), fakeRow(2), fakeRow(3)];
    collection.clearRowsFromTableAndFilter(rebuilt);
    expect(rebuilt.map((row) => Boolean(row.marked))).toEqual([true, false, false]);

    // The user unselects all rows, then marks a different row.
    rebuilt.forEach((row) => (row.marked = false));
    rebuilt[1].marked = true;

    // Second cycle: only the newly marked row may come back marked.
    collection.setColumnFilter('some-key', 'value-3');
    collection.setColumnFilter('some-key', '');
    rebuilt = [fakeRow(1), fakeRow(2), fakeRow(3)];
    collection.clearRowsFromTableAndFilter(rebuilt);

    expect(rebuilt.map((row) => Boolean(row.marked))).toEqual([false, true, false]);
  });

  it('forgets retained marks when the collection is cleared', () => {
    collection.addRows([fakeRow(1, true)]);

    collection.setColumnRegexFilter('some-key', 'value-2');
    collection.clear();
    collection.setColumnFilter('some-key', '');

    const rebuilt = fakeRow(1);
    collection.clearRowsFromTableAndFilter([rebuilt]);

    expect(rebuilt.marked).toBeFalsy();
  });
});
