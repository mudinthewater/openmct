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

function escapeHtmlValue(value) {
  return sanitizeCellValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Encode formatted rows as an HTML document containing a table. Offered
 * to the clipboard alongside the plain-text encoding so that rich-text
 * targets (for example a GitHub issue, which converts pasted HTML
 * tables to Markdown tables) receive a real table while plain-text
 * targets keep the CSV encoding. The document framing and newline
 * before the table match spreadsheet clipboard HTML: browsers add
 * document wrappers when handing this flavor to a page, and the newline
 * keeps those wrappers from running into the converted Markdown table.
 * @param {Object[]} rows formatted row objects keyed by column key
 * @param {string[]} columnKeys column keys in display order
 * @returns {string} HTML document markup containing the table
 */
export function encodeRowsToHtml(rows, columnKeys) {
  const header = columnKeys.map((key) => `<th>${escapeHtmlValue(key)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columnKeys.map((key) => `<td>${escapeHtmlValue(row[key])}</td>`).join('')}</tr>`
    )
    .join('');

  return `<html><head><meta charset="utf-8"></head><body>\n<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

/**
 * Copy text to the clipboard, falling back to a temporary textarea and
 * `document.execCommand('copy')` when the asynchronous Clipboard API is
 * unavailable (for example on non-secure origins). When HTML markup is
 * provided and the multi-format Clipboard API is available, both the
 * plain text and the HTML are offered so each paste target can pick the
 * format it understands.
 * @param {string} text text to copy
 * @param {string} [html] optional HTML representation of the same content
 * @returns {Promise<boolean>} true when the text was copied
 */
export async function copyTextToClipboard(text, html) {
  if (!text) {
    return false;
  }

  if (html && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        })
      ]);

      return true;
    } catch {
      // Fall through to the plain-text paths below.
    }
  }

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopyText(text)
    );
  }

  return fallbackCopyText(text);
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
