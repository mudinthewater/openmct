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

const COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY = 'copySelectedRowsTab';
const COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY = 'copySelectedRowsCsv';

const COPY_SELECTED_ROWS_ACTION_KEYS = [
  COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY,
  COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY
];

/**
 * Row context action that copies the marked (selected) telemetry table rows
 * to the clipboard, configured for either tab-delimited or CSV text. The
 * action is only applicable to telemetry table views with at least one
 * marked row, so it never appears in menus when nothing is selected.
 */
class CopySelectedRowsAction {
  /**
   * @param {import('openmct').OpenMCT} openmct
   * @param {Object} options
   * @param {string} options.key action key
   * @param {string} options.name menu label
   * @param {string} options.description hover description
   * @param {string} options.copyMethod name of the view context copy method
   */
  constructor(openmct, { key, name, description, copyMethod }) {
    this.openmct = openmct;
    this.key = key;
    this.name = name;
    this.description = description;
    this.copyMethod = copyMethod;
    this.cssClass = 'icon-duplicate';
    this.hideInDefaultMenu = true;
  }

  invoke(objectPath, view) {
    const viewContext = view.getViewContext && view.getViewContext();

    viewContext?.[this.copyMethod]?.();
  }

  appliesTo(objectPath, view = {}) {
    const viewContext = view.getViewContext && view.getViewContext();

    return viewContext?.type === 'telemetry-table' && viewContext.hasMarkedRows === true;
  }
}

export {
  COPY_SELECTED_ROWS_ACTION_KEYS,
  COPY_SELECTED_ROWS_AS_CSV_ACTION_KEY,
  COPY_SELECTED_ROWS_AS_TAB_ACTION_KEY,
  CopySelectedRowsAction
};
