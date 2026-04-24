import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { HISTORICAL_LOCATIONS, TYPE_CONFIG, FIGURE_JOURNEYS } from '@/lib/mapData';
import { FIGURES, CATEGORIES } from '@/lib/figuresData';
import { X, MapPin, Route } from 'lucide-react';
import FigureJourney from '@/components/FigureJourney';

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;

// Filter panel
function FilterPanel({ activeTypes, onToggle, hidden }) {
  if (hidden) return null;
  return (
    <div className="absolute top-3 left-3 z-[1000] bg-card/95 backdrop-blur border border-border rounded-xl p-3 shadow-xl space-y-2">
      <p className="text-[10px] font-cinzel text-gold tracking-wider font-semibold">ШҮҮЛТҮҮР</p>
      {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
        <button
          key={type}
          onClick={() => onToggle(type)}
          className={`flex items-center gap-2 w-full px-2 py-1 rounded-lg text-xs font-body transition-all ${
            activeTypes.includes(type)
              ? 'text-foreground'
              : 'text-muted-foreground opacity-50'
          }`}
        >
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
          {cfg.label}
        </button>
      ))}
    </div>
  );
}

// Info panel for selected location
function LocationPanel({ loc, onClose }) {
  const navigate = useNavigate();
  if (!loc) return null;
  const figures = (loc.figIds || []).map(id => FIGURES.find(f => f.fig_id === id)).filter(Boolean);

  return (
    <div className="absolute bottom-4 left-3 right-3 z-[1000] max-w-sm mx-auto bg-card/98 backdrop-blur border border-gold/30 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{loc.ico}</span>
          <div>
            <h3 className="font-cinzel font-bold text-foreground text-sm leading-tight">{loc.title}</h3>
            <span
              className="text-[10px] font-body px-1.5 py-0.5 rounded-full text-white"
              style={{ background: TYPE_CONFIG[loc.type]?.color }}
            >
              {TYPE_CONFIG[loc.type]?.label} · {loc.era}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs font-body text-muted-foreground mb-3 leading-relaxed">{loc.desc}</p>
      {figures.length > 0 && (
        <div>
          <p className="text-[10px] font-cinzel text-gold tracking-wider mb-2">ХОЛБООТОЙ ЗҮТГЭЛТНҮҮД</p>
          <div className="flex flex-wrap gap-1.5">
            {figures.map(fig => {
              const cat = CATEGORIES[fig.cat];
              return (
                <button
                  key={fig.fig_id}
                  onClick={() => navigate(`/figure/${fig.fig_id}`)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-body text-white transition-all hover:opacity-80 hover:scale-105"
                  style={{ background: cat?.color }}
                >
                  <span>{fig.ico}</span>
                  <span>{fig.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FlyToFigure({ figId }) {
  const map = useMap();
  useEffect(() => {
    if (!figId) return;
    const locs = HISTORICAL_LOCATIONS.filter(l => l.figIds?.includes(figId));
    if (locs.length > 0) map.flyTo([locs[0].lat, locs[0].lng], 5, { duration: 1.2 });
  }, [figId, map]);
  return null;
}

// Journey figure selector panel
function JourneySelector({ onSelect, onClose }) {
  const journeyFigures = Object.keys(FIGURE_JOURNEYS).map(id =>
    FIGURES.find(f => f.fig_id === Number(id))
  ).filter(Boolean);

  return (
    <div className="absolute top-3 left-3 z-[1000] bg-card/98 backdrop-blur border border-gold/40 rounded-2xl p-4 shadow-2xl w-64">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-cinzel text-gold tracking-wider font-semibold">АЯНЫ ЗАМ</p>
          <p className="text-xs font-body text-muted-foreground">Зүтгэлтэн сонгоно уу</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {journeyFigures.map(fig => {
          const cat = CATEGORIES[fig.cat];
          const journey = FIGURE_JOURNEYS[fig.fig_id];
          return (
            <button
              key={fig.fig_id}
              onClick={() => onSelect(fig.fig_id)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left hover:bg-muted/60 transition-all group"
            >
              <span className="text-lg">{fig.ico}</span>
              <div className="min-w-0">
                <p className="font-cinzel text-xs font-bold text-foreground group-hover:text-gold transition-colors truncate">{fig.name}</p>
                <p className="text-[10px] font-body text-muted-foreground">{journey.waypoints.length} цэг</p>
              </div>
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"
                style={{ background: cat?.color }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoricalMap({ highlightFigId = null }) {
  const [activeTypes, setActiveTypes] = useState(Object.keys(TYPE_CONFIG));
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [journeyMode, setJourneyMode] = useState(false);
  const [journeyFigId, setJourneyFigId] = useState(null);
  const [showJourneySelector, setShowJourneySelector] = useState(false);

  const toggleType = (type) => {
    setActiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSelectJourney = (figId) => {
    setJourneyFigId(figId);
    setShowJourneySelector(false);
    setSelectedLoc(null);
  };

  const handleCloseJourney = () => {
    setJourneyFigId(null);
    setJourneyMode(false);
    setShowJourneySelector(false);
  };

  const handleToggleJourneyMode = () => {
    if (journeyFigId) {
      handleCloseJourney();
    } else {
      setJourneyMode(true);
      setShowJourneySelector(true);
      setSelectedLoc(null);
    }
  };

  const filtered = HISTORICAL_LOCATIONS.filter(loc => activeTypes.includes(loc.type));
  const isJourneyActive = !!journeyFigId;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-2xl" style={{ height: 520, isolation: 'isolate' }}>
      <MapContainer
        center={[45, 80]}
        zoom={3}
        style={{ width: '100%', height: '100%', background: '#0d1117' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />

        {highlightFigId && !isJourneyActive && <FlyToFigure figId={highlightFigId} />}

        {/* Regular location dots (hidden in journey mode) */}
        {!isJourneyActive && filtered.map(loc => {
          const isHighlighted = highlightFigId ? loc.figIds?.includes(highlightFigId) : false;
          const isSelected = selectedLoc?.id === loc.id;
          const radius = isHighlighted ? 14 : isSelected ? 12 : 8;
          const fillColor = TYPE_CONFIG[loc.type]?.color || '#D4A843';
          return (
            <CircleMarker
              key={loc.id}
              center={[loc.lat, loc.lng]}
              radius={radius}
              fillColor={fillColor}
              fillOpacity={isHighlighted || isSelected ? 0.9 : 0.7}
              color={isHighlighted ? '#fff' : fillColor}
              weight={isHighlighted ? 2.5 : 1.5}
              eventHandlers={{ click: () => setSelectedLoc(isSelected ? null : loc) }}
            />
          );
        })}

        {/* Journey overlay */}
        {isJourneyActive && (
          <FigureJourney figId={journeyFigId} onClose={handleCloseJourney} />
        )}
      </MapContainer>

      {/* Filter panel — hidden during journey */}
      <FilterPanel activeTypes={activeTypes} onToggle={toggleType} hidden={isJourneyActive || showJourneySelector} />

      {/* Journey selector */}
      {showJourneySelector && !isJourneyActive && (
        <JourneySelector onSelect={handleSelectJourney} onClose={() => { setShowJourneySelector(false); setJourneyMode(false); }} />
      )}

      {/* Location info panel */}
      {!isJourneyActive && (
        <LocationPanel loc={selectedLoc} onClose={() => setSelectedLoc(null)} />
      )}

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 items-end">
        {/* Journey toggle button */}
        <button
          onClick={handleToggleJourneyMode}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-body border shadow-lg transition-all ${
            isJourneyActive || showJourneySelector
              ? 'bg-gold text-background border-gold font-bold'
              : 'bg-card/90 backdrop-blur border-border text-muted-foreground hover:text-foreground hover:border-gold/50'
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          {isJourneyActive ? 'Зам Хаах' : 'Аяны Зам'}
        </button>

        {/* Legend */}
        {!isJourneyActive && !showJourneySelector && (
          <div className="bg-card/90 backdrop-blur border border-border rounded-xl px-3 py-2">
            <p className="text-[10px] font-cinzel text-gold tracking-wider mb-1">ГАЗРЫН ЗУРАГ</p>
            <p className="text-[9px] text-muted-foreground font-body">Цэг дээр дарж дэлгэрэнгүй үзнэ үү</p>
          </div>
        )}
      </div>
    </div>
  );
}