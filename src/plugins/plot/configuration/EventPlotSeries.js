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
import PlotSeries from './PlotSeries.js';

/**
 * EventPlotSeries handles discrete events with only x-values.
 * These events are rendered as vertical lines at specific x positions.
 */
export default class EventPlotSeries extends PlotSeries {
  /**
   * @param {import('./Model').ModelOptions<PlotSeriesModelType, PlotSeriesModelOptions>} options
   */
  constructor(options) {
    super(options);
    this.type = 'event';
    this.set('markerShape', 'verticalLine');
    this.set('markerSize', 1.0);
  }

  /**
   * @override
   * Set defaults for event telemetry series.
   * Events do not have a y-axis range, so handle unit accordingly.
   */
  defaultModel(options) {
    this.metadata = options.openmct.telemetry.getMetadata(options.domainObject);

    this.formats = options.openmct.telemetry.getFormatMap(this.metadata);

    return {
      name: options.domainObject.name,
      unit: null,
      xKey: options.collection.plot.xAxis.get('key'),
      yKey: null,
      markers: true,
      markerShape: 'verticalLine',
      markerSize: 1.0,
      alarmMarkers: true,
      limitLines: false,
      yAxisId: null,
      interpolate: 'none'
    };
  }

  /**
   * Overrides the add method to handle points without y-values.
   * Assigns a vertical line at the x-value spanning the y-axis range.
   *
   * @param {Object} point - The telemetry data point with only an x-value.
   * @param {boolean} [sorted=false] - Whether the point is pre-sorted.
   */
  add(point, sorted = false) {
    if (point.y !== undefined) {
      console.warn('EventPlotSeries expects points with only x-values.');
    }

    // Ensure the point has only x-value
    const eventPoint = { ...point, y: null };

    // Call the parent class's add method with the modified point
    super.add(eventPoint, sorted);
  }

  isValueInvalid(val) {
    // Events do not use y-values, so always return false
    return false;
    }

  /**
   * Overrides the formatY method to return undefined or a default range.
   * Since events don't have y-values, y formatting isn't required.
   *
   * @param {number|null} y - The y-value (null for events).
   * @returns {string}
   */
  formatY(y) {
    return '';
  }

  /**
   * Overrides the evaluate method to return a consistent evaluation for events.
   *
   * @param {Object} datum - The telemetry data point.
   * @returns {Object} - Evaluation result.
   */
  evaluate(datum) {
    return {
      cssClass: 'c-plot-event',
      // Events span the entire y-axis, so high and low can be null or ignored
      high: null,
      low: null,
      name: this.get('name')
    };
  }

  /**
   * Overrides the getSeriesData method if specific processing is needed.
   *
   * @returns {Array<Object>}
   */
  getSeriesData() {
    return super.getSeriesData().filter((point) => point.x !== undefined);
  }
}
