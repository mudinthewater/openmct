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

import { copyTextToClipboard, encodeRowsToCsv, encodeRowsToTab } from './copySelectedRows.js';
import {
  COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY,
  COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY,
  CopySelectedRowsAction
} from './CopySelectedRowsAction.js';
import TelemetryTableRow from './TelemetryTableRow.js';

describe('copy selected rows', () => {
  describe('encodeRowsToCsv', () => {
    it('encodes a header row plus one CSV line per row in column order', () => {
      const rows = [
        { ID: 'CH1', Title: 'Bus Voltage', Value: '28.1' },
        { ID: 'CH2', Title: 'Bus Current', Value: '4.2' }
      ];

      expect(encodeRowsToCsv(rows, ['ID', 'Title', 'Value'])).toBe(
        '"ID","Title","Value"\r\n"CH1","Bus Voltage","28.1"\r\n"CH2","Bus Current","4.2"'
      );
    });

    it('quotes delimiters and blanks nulls', () => {
      const rows = [{ ID: 'CH1', Title: 'a,b"c', Value: null }];

      expect(encodeRowsToCsv(rows, ['ID', 'Title', 'Value'])).toBe(
        '"ID","Title","Value"\r\n"CH1","a,b""c",""'
      );
    });

    it('neutralizes spreadsheet formulas in the name column like CSV export', () => {
      const rows = [{ name: '=cmd|calc', value: '1' }];

      expect(encodeRowsToCsv(rows, ['name', 'value'])).toBe('"name","value"\r\n"\'=cmd|calc","1"');
    });
  });

  describe('encodeRowsToTab', () => {
    it('encodes a header row plus one line per row joined by tabs', () => {
      const rows = [
        { ID: 'CH1', Title: 'Bus Voltage', Value: '28.1' },
        { ID: 'CH2', Title: 'Bus Current', Value: '4.2' }
      ];

      expect(encodeRowsToTab(rows, ['ID', 'Title', 'Value'])).toBe(
        'ID\tTitle\tValue\nCH1\tBus Voltage\t28.1\nCH2\tBus Current\t4.2'
      );
    });

    it('replaces tabs and line breaks inside values and blanks nulls', () => {
      const rows = [{ ID: 'CH\t1', Title: 'a\nb', Value: null }];

      expect(encodeRowsToTab(rows, ['ID', 'Title', 'Value'])).toBe('ID\tTitle\tValue\nCH 1\ta b\t');
    });
  });

  describe('copyTextToClipboard', () => {
    let realClipboard;

    beforeEach(() => {
      realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    });

    afterEach(() => {
      if (realClipboard) {
        Object.defineProperty(navigator, 'clipboard', realClipboard);
      } else {
        delete navigator.clipboard;
      }
    });

    function stubClipboard(writeText) {
      Object.defineProperty(navigator, 'clipboard', {
        value: writeText ? { writeText } : undefined,
        configurable: true
      });
    }

    it('resolves false for empty text without touching the clipboard', async () => {
      const writeText = jasmine.createSpy('writeText');

      stubClipboard(writeText);

      expect(await copyTextToClipboard('')).toBe(false);
      expect(writeText).not.toHaveBeenCalled();
    });

    it('uses navigator.clipboard when available', async () => {
      const writeText = jasmine.createSpy('writeText').and.resolveTo();

      stubClipboard(writeText);

      expect(await copyTextToClipboard('a\tb')).toBe(true);
      expect(writeText).toHaveBeenCalledWith('a\tb');
    });

    it('falls back to execCommand when the clipboard API rejects', async () => {
      stubClipboard(jasmine.createSpy('writeText').and.rejectWith(new Error('denied')));
      spyOn(document, 'execCommand').and.returnValue(true);

      expect(await copyTextToClipboard('a\tb')).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(document.querySelectorAll('textarea').length).toBe(0);
    });

    it('falls back to execCommand when the clipboard API is missing', async () => {
      stubClipboard(null);
      spyOn(document, 'execCommand').and.returnValue(true);

      expect(await copyTextToClipboard('a\tb')).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(document.querySelectorAll('textarea').length).toBe(0);
    });
  });

  describe('actions', () => {
    function fakeView(viewContext) {
      return {
        getViewContext: () => viewContext
      };
    }

    it('exposes the action keys used by table rows', () => {
      expect(COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY).toBe('copySelectedRowsTab');
      expect(COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY).toBe('copySelectedRowsCsv');
    });

    function csvAction() {
      return new CopySelectedRowsAction(
        {},
        {
          key: COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY,
          name: 'Copy Selected (CSV)',
          description: 'Copy the selected table rows to the clipboard as CSV text',
          copyMethod: 'copySelectedRowsAsCSV'
        }
      );
    }

    it('applies only to telemetry table views with marked rows', () => {
      const action = csvAction();

      expect(action.appliesTo([], fakeView({ type: 'telemetry-table', hasMarkedRows: true }))).toBe(
        true
      );
      expect(
        action.appliesTo([], fakeView({ type: 'telemetry-table', hasMarkedRows: false }))
      ).toBe(false);
      expect(action.appliesTo([], fakeView({ type: 'plot', hasMarkedRows: true }))).toBe(false);
      expect(action.appliesTo([], {})).toBe(false);
    });

    it('invokes the matching view context copy method', () => {
      const copyAsCSV = jasmine.createSpy('copySelectedRowsAsCSV');
      const copyAsTab = jasmine.createSpy('copySelectedRowsAsTab');
      const view = fakeView({
        type: 'telemetry-table',
        hasMarkedRows: true,
        copySelectedRowsAsCSV: copyAsCSV,
        copySelectedRowsAsTab: copyAsTab
      });

      csvAction().invoke([], view);
      new CopySelectedRowsAction(
        {},
        {
          key: COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY,
          name: 'Copy Selected (Tab)',
          description: 'Copy the selected table rows to the clipboard as tab-delimited text',
          copyMethod: 'copySelectedRowsAsTab'
        }
      ).invoke([], view);

      expect(copyAsCSV).toHaveBeenCalledTimes(1);
      expect(copyAsTab).toHaveBeenCalledTimes(1);
    });
  });

  describe('menu wiring', () => {
    it('lists both copy actions in telemetry table row context menus', () => {
      const row = new TelemetryTableRow({}, {}, 'some-key', null);

      expect(row.getContextMenuActions()).toEqual([
        'viewDatumAction',
        'viewHistoricalData',
        COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY,
        COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY
      ]);
    });
  });
});
