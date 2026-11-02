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
import CSV from 'comma-separated-values';

import { sanitizeCsvFormulaInjection } from '@/exporters/CSVExporter.js';

function sanitizeCellValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

/**
 * Encode formatted rows as CSV text with a header row. The `name` column is
 * sanitized against spreadsheet formula injection, mirroring CSV export.
 * @param {Object[]} rows formatted row objects keyed by column key
 * @param {string[]} columnKeys column keys in display order
 * @returns {string} CSV text
 */
export function encodeRowsToCsv(rows, columnKeys) {
  const sanitized = rows.map((row) => {
    const clean = {};

    columnKeys.forEach((key) => {
      clean[key] = sanitizeCellValue(row[key]);
    });

    if ('name' in clean) {
      clean.name = sanitizeCsvFormulaInjection(clean.name);
    }

    return clean;
  });

  return new CSV(sanitized, { header: columnKeys }).encode();
}

/**
 * Encode formatted rows as tab-delimited text with a header row, suitable
 * for pasting into a spreadsheet. Tabs and line breaks inside cell values
 * are replaced with spaces so they cannot break the column structure.
 * @param {Object[]} rows formatted row objects keyed by column key
 * @param {string[]} columnKeys column keys in display order
 * @returns {string} tab-delimited text
 */
export function encodeRowsToTab(rows, columnKeys) {
  function encodeRow(values) {
    return values.map((value) => sanitizeCellValue(value).replace(/[\t\r\n]+/g, ' ')).join('\t');
  }

  return [
    encodeRow(columnKeys),
    ...rows.map((row) => encodeRow(columnKeys.map((key) => row[key])))
  ].join('\n');
}

/**
 * Copy text to the clipboard, falling back to a temporary textarea and
 * `document.execCommand('copy')` when the asynchronous Clipboard API is
 * unavailable (for example on non-secure origins).
 * @param {string} text text to copy
 * @returns {Promise<boolean>} true when the text was copied
 */
export function copyTextToClipboard(text) {
  if (!text) {
    return Promise.resolve(false);
  }

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopyText(text)
    );
  }

  return Promise.resolve(fallbackCopyText(text));
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);

  return copied;
}
