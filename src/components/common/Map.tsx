"use client";

import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

const center = {
  lat: 48.770528,
  lng: 2.505609,
};

export function Map() {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: "AIzaSyCVskVxX84bcaEy7OeNhlpoksqvk68l3fA",
  });

  if (!isLoaded) {
    return <div className="h-[400px] w-full animate-pulse bg-gray-800" />;
  }

  return (
    <GoogleMap mapContainerClassName="w-full h-[400px]" center={center} zoom={15}>
      <Marker position={center} />
    </GoogleMap>
  );
}
