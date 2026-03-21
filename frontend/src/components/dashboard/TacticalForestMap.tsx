'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Dynamically import leaflet.heat only on the client
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.L = L;
  require('leaflet.heat');
}

// Fix for default marker icons in Leaflet + Next.js
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Heatmap Layer Component
const HeatmapLayer = ({ points }: { points: [number, number, number][] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    // @ts-ignore - Leaflet.heat is a plugin
    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 14,
      gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
};

// Component to handle Ctrl + Scroll for Zooming
const CtrlZoomHandler = () => {
  const map = useMap();
  
  useEffect(() => {
    // Initially disable scroll zoom
    map.scrollWheelZoom.disable();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        map.getContainer().style.cursor = 'zoom-in';
        map.scrollWheelZoom.enable();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        map.getContainer().style.cursor = '';
        map.scrollWheelZoom.disable();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [map]);
  
  return null;
};

// Helper to generate a grid of forest compartments (simulating the detail in the image)
const generateForestGrid = (startLat: number, startLng: number, rows: number, cols: number, step: number) => {
  const features = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const lat = startLat + (i * step);
      const lng = startLng + (j * step);
      features.push({
        "type": "Feature",
        "properties": { 
          "name": `Compartment ${100 + (i * cols) + j}`, 
          "type": "Beat",
          "density": Math.random() 
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [lng, lat], [lng + step, lat], [lng + step, lat + step], [lng, lat + step], [lng, lat]
          ]]
        }
      });
    }
  }
  return features;
};

const rangeBoundary: any = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Bhanupratappur East Range", "type": "Range" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [81.05, 20.35], [81.30, 20.35], [81.30, 20.15], [81.05, 20.15], [81.05, 20.35]
        ]]
      }
    }
  ]
};

const compartmentGrid: any = {
  "type": "FeatureCollection",
  "features": generateForestGrid(20.18, 81.10, 8, 10, 0.015)
};

const heatmapData: [number, number, number][] = [
  ...Array.from({ length: 40 }).map(() => [
    20.20 + (Math.random() * 0.1), 
    81.12 + (Math.random() * 0.15), 
    Math.random()
  ] as [number, number, number])
];

const TacticalForestMap = ({ incidents = [] }: { incidents?: any[] }) => {
  const [showGeofence, setShowGeofence] = useState(true);
  const [showCompartments, setShowCompartments] = useState(true);
  const center: [number, number] = [20.2741, 81.1610]; // Bhanupratappur

  const rangeStyle = {
    color: "#00ffff", // Bright Cyan for high visibility
    weight: 4,
    fillOpacity: 0.05,
    dashArray: '10, 10'
  };

  const compartmentStyle = {
    color: "#ffffff",
    weight: 1,
    opacity: 0.3,
    fillColor: "#3b82f6",
    fillOpacity: 0.03
  };

  const onEachRange = (feature: any, layer: any) => {
    layer.bindPopup(`<strong>${feature.properties.name}</strong><br/>DFO Boundary Geofence`);
  };

  const onEachCompartment = (feature: any, layer: any) => {
    layer.bindPopup(`<strong>${feature.properties.name}</strong><br/>Detailed Forest Compartment`);
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl">
      <MapContainer 
        center={center} 
        zoom={12} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
        scrollWheelZoom={false}
      >
        <CtrlZoomHandler />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite View">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Normal View">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="🔥 Heatmap Intel">
            <HeatmapLayer points={heatmapData} />
          </LayersControl.Overlay>
        </LayersControl>

        {showGeofence && (
          <GeoJSON 
            data={rangeBoundary} 
            style={rangeStyle}
            onEachFeature={onEachRange}
          />
        )}

        {showCompartments && (
          <GeoJSON 
            data={compartmentGrid} 
            style={compartmentStyle}
            onEachFeature={onEachCompartment}
          />
        )}

        {/* Live Incident Markers */}
        {incidents.map((incident, idx) => {
          const lat = 20.25 + (idx * 0.02);
          const lng = 81.14 + (idx * 0.03);
          
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div class="relative w-8 h-8 flex items-center justify-center transform -translate-x-1/4 -translate-y-1/4">
                <div class="absolute inset-0 rounded-full animate-ping opacity-20 ${incident.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}"></div>
                <div class="w-4 h-4 rounded-full border-2 border-white shadow-xl ${incident.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}"></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          return (
            <Marker key={incident.id || idx} position={[lat, lng]} icon={icon}>
              <Popup>
                <div className="text-[10px] w-40 font-sans">
                  <span className={`block font-black uppercase tracking-widest ${incident.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>
                    {incident.severity}: {incident.title}
                  </span>
                  <p className="mt-1 font-bold text-slate-700">Area: {incident.area || 'Unknown Beat'}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Map UI Overlays / Buttons */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
           <button 
             onClick={() => setShowGeofence(!showGeofence)}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
               showGeofence ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-slate-900/80 text-slate-400 border-white/10 backdrop-blur-md'
             }`}
           >
             {showGeofence ? '✅ Geofences On' : '❌ Geofences Off'}
           </button>
           <button 
             onClick={() => setShowCompartments(!showCompartments)}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
               showCompartments ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900/80 text-slate-400 border-white/10 backdrop-blur-md'
             }`}
           >
             {showCompartments ? '✅ Compartments On' : '❌ Compartments Off'}
           </button>
        </div>

        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl pointer-events-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></div>
              <span className="text-[10px] text-white font-black uppercase tracking-widest">Active Wildfire Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Patrol Beacon</span>
            </div>
          </div>
        </div>
      </MapContainer>
    </div>
  );
};

export default TacticalForestMap;
