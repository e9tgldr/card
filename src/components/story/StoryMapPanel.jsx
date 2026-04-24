import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FIGURE_GEO, ERA_GEO_DEFAULT } from '@/lib/mapData';
import { getEra } from '@/lib/figuresData';

function FocusController({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.lat, focus?.lng, focus?.zoom]);
  return null;
}

/** Resolve {lat,lng,zoom} for a figure, falling back to its era default. */
export function resolveFocus(figure) {
  if (!figure) return ERA_GEO_DEFAULT.founding;
  const direct = FIGURE_GEO[figure.fig_id];
  if (direct) return direct;
  const era = getEra(figure);
  return ERA_GEO_DEFAULT[era] ?? ERA_GEO_DEFAULT.founding;
}

export default function StoryMapPanel({ figure, era, className = '' }) {
  const focus = figure
    ? resolveFocus(figure)
    : (era ? ERA_GEO_DEFAULT[era] ?? ERA_GEO_DEFAULT.founding : ERA_GEO_DEFAULT.founding);

  return (
    <div className={`relative overflow-hidden bg-[#1a140c] ${className}`}>
      <MapContainer
        center={[focus.lat, focus.lng]}
        zoom={focus.zoom}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        style={{ width: '100%', height: '100%', background: '#1a140c' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.55}
        />
        <CircleMarker
          center={[focus.lat, focus.lng]}
          radius={8}
          pathOptions={{ color: '#C8992A', fillColor: '#C8992A', fillOpacity: 0.75, weight: 2 }}
        />
        <FocusController focus={focus} />
      </MapContainer>
    </div>
  );
}
