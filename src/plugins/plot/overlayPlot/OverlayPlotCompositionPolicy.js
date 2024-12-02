export default function OverlayPlotCompositionPolicy(openmct) {
  function hasNumericTelemetry(domainObject) {
    const hasTelemetry = openmct.telemetry.isTelemetryObject(domainObject);
    if (!hasTelemetry) {
      return false;
    }

    let metadata = openmct.telemetry.getMetadata(domainObject);
    console.debug(
      `🗺️ the metadata values length is ${metadata.values().length}, and the domain and range check is ${hasDomain(metadata)}`
    );

    return metadata.values().length > 0 && hasDomain(metadata);
  }

  function hasDomain(metadata) {
    return metadata.valuesForHints(['domain']).length > 0;
  }

  return {
    allow: function (parent, child) {
      if (parent.type === 'telemetry.plot.overlay' && hasNumericTelemetry(child) === false) {
        return false;
      }

      return true;
    }
  };
}
