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

const COPY_SELECTED_ROWS_ACTION_KEY = 'copySelectedRows';

/**
 * Row context action that copies the marked (selected) telemetry table rows
 * to the clipboard as CSV text, with an HTML table flavor for rich-text
 * paste targets. The action is only applicable to telemetry table views
 * with at least one marked row, so it never appears in menus when nothing
 * is selected.
 */
class CopySelectedRowsAction {
  /**
   * @param {import('openmct').OpenMCT} openmct
   */
  constructor(openmct) {
    this.openmct = openmct;
    this.key = COPY_SELECTED_ROWS_ACTION_KEY;
    this.name = 'Copy Selected';
    this.description = 'Copy the selected table rows to the clipboard as CSV text';
    this.cssClass = 'icon-duplicate';
    this.hideInDefaultMenu = true;
  }

  invoke(objectPath, view) {
    const viewContext = view.getViewContext && view.getViewContext();

    viewContext?.copySelectedRows?.();
  }

  appliesTo(objectPath, view = {}) {
    const viewContext = view.getViewContext && view.getViewContext();

    return viewContext?.type === 'telemetry-table' && viewContext.hasMarkedRows === true;
  }
}

export { COPY_SELECTED_ROWS_ACTION_KEY, CopySelectedRowsAction };
