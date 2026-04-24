import { useState, useEffect, useRef } from 'react';
import { useMap, Polyline, CircleMarker } from 'react-leaflet';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { FIGURE_JOURNEYS } from '@/lib/mapData';
import { FIGURES, CATEGORIES } from '@/lib/figuresData';

// Animates the map to fly between waypoints
function JourneyAnimator({ waypoints, currentStep }) {
  const map = useMap();
  const prevStep = useRef(-1);

  useEffect(() => {
    if (!waypoints || waypoints.length === 0) return;
    if (currentStep === prevStep.current) return;
    prevStep.current = currentStep;
    const wp = waypoints[currentStep];
    map.flyTo([wp.lat, wp.lng], 5, { duration: 1.4, easeLinearity: 0.3 });
  }, [currentStep, waypoints, map]);

  return null;
}

// Draws the path and waypoint markers on the map
function JourneyPath({ waypoints, currentStep, onStepClick }) {
  const positions = waypoints.map(w => [w.lat, w.lng]);

  return (
    <>
      {/* Full faded path */}
      <Polyline
        positions={positions}
        pathOptions={{ color: '#D4A843', weight: 2, opacity: 0.3, dashArray: '6 6' }}
      />
      {/* Progress path */}
      {currentStep > 0 && (
        <Polyline
          positions={positions.slice(0, currentStep + 1)}
          pathOptions={{ color: '#D4A843', weight: 3, opacity: 0.9 }}
        />
      )}
      {/* Waypoint markers */}
      {waypoints.map((wp, i) => {
        const isPast = i < currentStep;
        const isCurrent = i === currentStep;
        const isFuture = i > currentStep;
        return (
          <CircleMarker
            key={i}
            center={[wp.lat, wp.lng]}
            radius={isCurrent ? 14 : 9}
            fillColor={isCurrent ? '#D4A843' : isPast ? '#8B1A1A' : '#555'}
            fillOpacity={isFuture ? 0.4 : 0.95}
            color={isCurrent ? '#fff' : isPast ? '#D4A843' : '#888'}
            weight={isCurrent ? 3 : 1.5}
            eventHandlers={{ click: () => onStepClick(i) }}
          />
        );
      })}
    </>
  );
}

// Sidebar panel with journey controls
function JourneyPanel({ journey, figure, currentStep, onStep, onClose }) {
  const wp = journey.waypoints[currentStep];
  const cat = CATEGORIES[figure?.cat];
  const total = journey.waypoints.length;

  return (
    <div className="absolute bottom-4 left-3 right-3 z-[1000] max-w-lg mx-auto">
      <div className="bg-card/98 backdrop-blur border border-gold/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">{figure?.ico}</span>
            <div>
              <p className="font-cinzel text-xs text-gold tracking-wider font-semibold">АЯНЫ ЗАМ</p>
              <p className="font-cinzel text-sm font-bold text-foreground leading-tight">{journey.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-4 py-2">
          {journey.waypoints.map((_, i) => (
            <button
              key={i}
              onClick={() => onStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'bg-gold flex-1' : i < currentStep ? 'bg-crimson w-4' : 'bg-muted w-4'
              }`}
            />
          ))}
        </div>

        {/* Current waypoint info */}
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
            <p className="font-cinzel text-sm font-bold text-foreground leading-tight">{wp.title}</p>
          </div>
          <p className="text-xs font-body text-muted-foreground leading-relaxed pl-5">{wp.desc}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            onClick={() => onStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Өмнөх
          </button>
          <span className="text-xs text-muted-foreground font-body">
            {currentStep + 1} / {total}
          </span>
          <button
            onClick={() => onStep(Math.min(total - 1, currentStep + 1))}
            disabled={currentStep === total - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body bg-gold/20 hover:bg-gold/30 text-gold disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            Дараах <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FigureJourney({ figId, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const journey = FIGURE_JOURNEYS[figId];
  const figure = FIGURES.find(f => f.fig_id === figId);

  if (!journey || !figure) return null;

  return (
    <>
      <JourneyAnimator waypoints={journey.waypoints} currentStep={currentStep} />
      <JourneyPath
        waypoints={journey.waypoints}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
      />
      <JourneyPanel
        journey={journey}
        figure={figure}
        currentStep={currentStep}
        onStep={setCurrentStep}
        onClose={onClose}
      />
    </>
  );
}