"use client";

import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, X } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for Leaflet default marker icons in Next.js
const fixLeafletIcon = () => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
};

// Component to recenter map when lat/lng changes
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
};

interface GrievanceMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  address?: string;
  grievanceId?: string;
}

export default function GrievanceMapDialog({
  isOpen,
  onClose,
  lat,
  lng,
  address,
  grievanceId,
}: GrievanceMapDialogProps) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      fixLeafletIcon();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 bg-[#00AEEF] shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 bg-[#00AEEF] border-b border-white/20 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 backdrop-blur-sm">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-base font-black uppercase tracking-tight">
                Geospatial Location
              </DialogTitle>
              <p className="text-[14px] font-bold text-white/80 uppercase tracking-widest mt-0.5">
                Grievance #{grievanceId} • {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            </div>
          </div>
          {/* Removed custom close button to avoid duplication with Dialog component default */}
        </DialogHeader>

        <div className="relative h-[60vh] w-full bg-slate-950">
          <MapContainer
            center={[lat, lng]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri'
              opacity={0.3}
            />
            <Marker position={[lat, lng]} />
            <RecenterMap lat={lat} lng={lng} />
          </MapContainer>

          {address && (
            <div className="absolute bottom-6 left-6 right-6 z-[1000]">
              <div className="bg-[#0f172a]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl ring-1 ring-[#00AEEF]/30">
                <p className="text-[15px] font-black text-[#00AEEF] uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> Reported Address
                </p>
                <p className="text-xs font-bold text-white tracking-tight leading-relaxed">
                  {address}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-[#00AEEF] border-t border-white/20 flex justify-end gap-3">
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-[15px] font-black uppercase tracking-widest rounded-lg transition-all border border-white/20 flex items-center gap-2"
          >
            Open in Google Maps
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-[#00AEEF] text-[15px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg active:scale-95"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
