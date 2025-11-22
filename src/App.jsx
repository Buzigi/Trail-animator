import { useState, useRef, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import html2canvas from 'html2canvas'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Icon SVG paths for different travel modes
const ICONS = {
  hiker: {
    name: 'Hiker',
    color: '#2E7D32',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="%23COLOR%" d="M12 2C13.1 2 14 2.9 14 4S13.1 6 12 6 10 5.1 10 4 10.9 2 12 2M21 9H15V22H13V16H11V22H9V9H3V7H21V9Z"/></svg>`,
    profile: 'foot'
  },
  car: {
    name: 'Car',
    color: '#1565C0',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="%23COLOR%" d="M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z"/></svg>`,
    profile: 'car'
  },
  bike: {
    name: 'Bike',
    color: '#F57C00',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="%23COLOR%" d="M5,18A3,3 0 0,1 2,15A3,3 0 0,1 5,12A3,3 0 0,1 8,15A3,3 0 0,1 5,18M5,10A5,5 0 0,0 0,15A5,5 0 0,0 5,20A5,5 0 0,0 10,15A5,5 0 0,0 5,10M14.5,6A1.5,1.5 0 0,1 13,4.5A1.5,1.5 0 0,1 14.5,3A1.5,1.5 0 0,1 16,4.5A1.5,1.5 0 0,1 14.5,6M16,11V8.5L12.5,12H9.5L8.5,14L10,15L12,12H14L18,8V11H16M19,18A3,3 0 0,1 16,15A3,3 0 0,1 19,12A3,3 0 0,1 22,15A3,3 0 0,1 19,18M19,10A5,5 0 0,0 14,15A5,5 0 0,0 19,20A5,5 0 0,0 24,15A5,5 0 0,0 19,10Z"/></svg>`,
    profile: 'bike'
  },
  runner: {
    name: 'Runner',
    color: '#C62828',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="%23COLOR%" d="M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.19L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z"/></svg>`,
    profile: 'foot'
  }
}

// Create custom icon for animated marker
const createAnimatedIcon = (iconType) => {
  const icon = ICONS[iconType]
  const svgString = icon.svg.replace('%23COLOR%', icon.color.replace('#', '%23'))

  return L.divIcon({
    html: svgString,
    className: 'animated-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

// Create waypoint icon
const createWaypointIcon = (index, total) => {
  let color = '#FF9800'
  if (index === 0) color = '#4CAF50'
  else if (index === total - 1) color = '#F44336'

  return L.divIcon({
    html: `<div class="waypoint-marker" style="background-color: ${color}">${index + 1}</div>`,
    className: 'waypoint-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Israel center coordinates
const israelCenter = [31.5, 35.0]

// Calculate bearing between two points
const calculateBearing = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => deg * Math.PI / 180
  const toDeg = (rad) => rad * 180 / Math.PI

  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Smooth easing function
const easeInOutCubic = (t) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Map click handler component
function MapClickHandler({ onMapClick, isPlaying }) {
  useMapEvents({
    click: (e) => {
      if (!isPlaying) {
        onMapClick(e.latlng)
      }
    }
  })
  return null
}

// Cinematic camera controller
function CinematicCamera({ position, bearing, isPlaying, progress }) {
  const map = useMap()
  const lastBearingRef = useRef(0)
  const targetBearingRef = useRef(0)
  const animationRef = useRef(null)

  useEffect(() => {
    if (!position || !isPlaying) return

    // Calculate target zoom based on progress (zoom in at start and end)
    const baseZoom = 15
    const zoomVariation = 1.5
    const progressEffect = Math.sin(progress * Math.PI) // Peak in middle
    const targetZoom = baseZoom + (progressEffect * zoomVariation * 0.3)

    // Smooth bearing interpolation
    targetBearingRef.current = bearing

    const animateCamera = () => {
      const currentBearing = lastBearingRef.current
      let targetBear = targetBearingRef.current

      // Handle 360-degree wrap-around
      let diff = targetBear - currentBearing
      if (diff > 180) diff -= 360
      if (diff < -180) diff += 360

      // Smooth interpolation
      const newBearing = currentBearing + diff * 0.08
      lastBearingRef.current = newBearing

      // Apply camera transformation
      map.setView([position.lat, position.lng], targetZoom, {
        animate: true,
        duration: 0.1,
        easeLinearity: 0.5
      })

      // Rotate map (if supported)
      if (map.setBearing) {
        map.setBearing(newBearing)
      }

      animationRef.current = requestAnimationFrame(animateCamera)
    }

    animationRef.current = requestAnimationFrame(animateCamera)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [position, bearing, isPlaying, progress, map])

  return null
}

// Search result handler
function SearchResultHandler({ searchResult, onSearchComplete }) {
  const map = useMap()

  useEffect(() => {
    if (searchResult) {
      map.setView([searchResult.lat, searchResult.lng], 15)
      onSearchComplete()
    }
  }, [searchResult, map, onSearchComplete])

  return null
}

function App() {
  const [waypoints, setWaypoints] = useState([])
  const [routePoints, setRoutePoints] = useState([]) // Actual route from OSRM
  const [selectedIcon, setSelectedIcon] = useState('hiker')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [currentBearing, setCurrentBearing] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [traveledDistance, setTraveledDistance] = useState(0)
  const [elevationData, setElevationData] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)

  const animationRef = useRef(null)
  const mapRef = useRef(null)
  const lastTimeRef = useRef(null)

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Fetch route from BRouter (hiking) or OSRM (car/bike)
  const fetchRoute = useCallback(async (points, profile) => {
    if (points.length < 2) {
      setRoutePoints([])
      return
    }

    setIsLoadingRoute(true)

    try {
      let coordinates = []
      let distanceKm = 0

      if (profile === 'foot') {
        // Use BRouter for hiking - it follows marked hiking trails
        const lonlats = points.map(p => `${p.lng},${p.lat}`).join('|')

        const response = await fetch(
          `https://brouter.de/brouter?lonlats=${lonlats}&profile=trekking&alternativeidx=0&format=geojson`
        )

        const data = await response.json()

        if (data.features && data.features[0]) {
          const feature = data.features[0]
          coordinates = feature.geometry.coordinates.map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }))

          // Calculate distance from coordinates
          for (let i = 1; i < coordinates.length; i++) {
            distanceKm += calculateDistance(
              coordinates[i-1].lat, coordinates[i-1].lng,
              coordinates[i].lat, coordinates[i].lng
            )
          }
        }
      } else {
        // Use OSRM for car/bike
        const coords = points.map(p => `${p.lng},${p.lat}`).join(';')
        const osrmProfile = profile === 'car' ? 'driving' : 'cycling'

        const response = await fetch(
          `https://router.project-osrm.org/route/v1/${osrmProfile}/${coords}?overview=full&geometries=geojson`
        )

        const data = await response.json()

        if (data.routes && data.routes[0]) {
          const route = data.routes[0]
          coordinates = route.geometry.coordinates.map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }))
          distanceKm = route.distance / 1000
        }
      }

      if (coordinates.length > 0) {
        setRoutePoints(coordinates)
        setTotalDistance(distanceKm)

        // Generate elevation data based on route points
        const mockElevation = coordinates.filter((_, i) => i % Math.max(1, Math.floor(coordinates.length / 50)) === 0)
          .map((_, i, arr) => ({
            distance: (i / arr.length) * distanceKm,
            elevation: 100 + Math.sin(i * 0.3) * 80 + Math.random() * 30
          }))
        setElevationData(mockElevation)
      }
    } catch (error) {
      console.error('Route fetch failed:', error)
      // Fallback to straight lines
      setRoutePoints(points)

      let total = 0
      for (let i = 1; i < points.length; i++) {
        total += calculateDistance(
          points[i-1].lat, points[i-1].lng,
          points[i].lat, points[i].lng
        )
      }
      setTotalDistance(total)
    } finally {
      setIsLoadingRoute(false)
    }
  }, [])

  // Fetch route when waypoints or icon changes
  useEffect(() => {
    if (waypoints.length >= 2) {
      fetchRoute(waypoints, ICONS[selectedIcon].profile)
    } else {
      setRoutePoints([])
      setTotalDistance(0)
      setElevationData([])
    }
  }, [waypoints, selectedIcon, fetchRoute])

  // Handle map click to add waypoints
  const handleMapClick = useCallback((latlng) => {
    if (isPlaying) return

    const newWaypoint = {
      lat: latlng.lat,
      lng: latlng.lng
    }
    setWaypoints(prev => [...prev, newWaypoint])
  }, [isPlaying])

  // Handle waypoint click to remove it
  const handleWaypointClick = useCallback((index) => {
    if (isPlaying) return
    setWaypoints(prev => prev.filter((_, i) => i !== index))
  }, [isPlaying])

  // Place search functionality
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=il&limit=1`
      )
      const data = await response.json()

      if (data && data.length > 0) {
        setSearchResult({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: data[0].display_name
        })
      } else {
        alert('Place not found. Try a different search term.')
      }
    } catch (error) {
      console.error('Search failed:', error)
      alert('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Interpolate position along the route
  const getPositionAtProgress = useCallback((progress) => {
    const points = routePoints.length > 0 ? routePoints : waypoints
    if (points.length < 2) return null

    // Calculate cumulative distances
    const distances = [0]
    let totalDist = 0
    for (let i = 1; i < points.length; i++) {
      const dist = calculateDistance(
        points[i-1].lat, points[i-1].lng,
        points[i].lat, points[i].lng
      )
      totalDist += dist
      distances.push(totalDist)
    }

    // Find position at progress
    const targetDist = progress * totalDist

    for (let i = 1; i < distances.length; i++) {
      if (distances[i] >= targetDist) {
        const segmentStart = distances[i-1]
        const segmentEnd = distances[i]
        const segmentProgress = (targetDist - segmentStart) / (segmentEnd - segmentStart)

        const start = points[i-1]
        const end = points[i]

        return {
          lat: start.lat + (end.lat - start.lat) * segmentProgress,
          lng: start.lng + (end.lng - start.lng) * segmentProgress,
          nextLat: end.lat,
          nextLng: end.lng
        }
      }
    }

    const last = points[points.length - 1]
    return { lat: last.lat, lng: last.lng, nextLat: last.lat, nextLng: last.lng }
  }, [routePoints, waypoints])

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }

    const deltaTime = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp

    setAnimationProgress(prev => {
      const increment = (deltaTime / 1000) * speed * 0.02 // Slower for cinematic effect
      let newProgress = prev + increment

      if (newProgress >= 1) {
        if (loop) {
          newProgress = 0
        } else {
          setIsPlaying(false)
          setIsPaused(false)
          return 1
        }
      }

      return newProgress
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [speed, loop])

  // Update current position and bearing based on progress
  useEffect(() => {
    const pos = getPositionAtProgress(animationProgress)
    if (pos) {
      setCurrentPosition(pos)
      setTraveledDistance(totalDistance * animationProgress)

      // Calculate bearing for camera rotation
      if (pos.nextLat && pos.nextLng) {
        const bearing = calculateBearing(pos.lat, pos.lng, pos.nextLat, pos.nextLng)
        setCurrentBearing(bearing)
      }
    }
  }, [animationProgress, getPositionAtProgress, totalDistance])

  // Start/stop animation
  useEffect(() => {
    if (isPlaying && !isPaused) {
      lastTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, isPaused, animate])

  // Control functions
  const handlePlay = () => {
    if (waypoints.length < 2) return
    if (animationProgress >= 1) {
      setAnimationProgress(0)
    }
    setIsPlaying(true)
    setIsPaused(false)
  }

  const handlePause = () => {
    setIsPaused(true)
  }

  const handleStop = () => {
    setIsPlaying(false)
    setIsPaused(false)
    setAnimationProgress(0)
    setCurrentPosition(null)
  }

  const handleProgressChange = (e) => {
    const newProgress = parseFloat(e.target.value)
    setAnimationProgress(newProgress)
  }

  const handleClear = () => {
    handleStop()
    setWaypoints([])
    setRoutePoints([])
    setTotalDistance(0)
    setTraveledDistance(0)
    setElevationData([])
  }

  // Video export functionality
  const exportVideo = async () => {
    if (waypoints.length < 2) return

    setIsExporting(true)

    try {
      const frames = []
      const fps = 30
      const duration = 10
      const totalFrames = fps * duration

      for (let i = 0; i <= totalFrames; i++) {
        setAnimationProgress(i / totalFrames)
        await new Promise(resolve => setTimeout(resolve, 50))

        const canvas = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: true
        })
        frames.push(canvas.toDataURL('image/webp', 0.8))
      }

      const link = document.createElement('a')
      link.download = 'trek-animation.webp'
      link.href = frames[frames.length - 1]
      link.click()

      alert('Animation exported! For full video export, consider using screen recording.')
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
      setAnimationProgress(0)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Trail Animator</h1>
        <p className="subtitle">Create and animate your journey</p>
      </header>

      <main className="main-content">
        <div className="map-container" ref={mapRef}>
          <MapContainer
            center={israelCenter}
            zoom={8}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://israelhiking.osm.org.il/Hebrew/Tiles/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://israelhiking.osm.org.il">Israel Hiking Map</a>'
              maxZoom={16}
            />

            <MapClickHandler onMapClick={handleMapClick} isPlaying={isPlaying} />
            <CinematicCamera
              position={currentPosition}
              bearing={currentBearing}
              isPlaying={isPlaying}
              progress={animationProgress}
            />
            <SearchResultHandler
              searchResult={searchResult}
              onSearchComplete={() => setSearchResult(null)}
            />

            {/* Trail path - use routed path if available */}
            {(routePoints.length > 1 || waypoints.length > 1) && (
              <Polyline
                positions={(routePoints.length > 1 ? routePoints : waypoints).map(w => [w.lat, w.lng])}
                color={ICONS[selectedIcon].color}
                weight={4}
                opacity={0.8}
              />
            )}

            {/* Waypoint markers */}
            {waypoints.map((point, index) => (
              <Marker
                key={index}
                position={[point.lat, point.lng]}
                icon={createWaypointIcon(index, waypoints.length)}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation()
                    handleWaypointClick(index)
                  }
                }}
              />
            ))}

            {/* Animated icon */}
            {currentPosition && (
              <Marker
                position={[currentPosition.lat, currentPosition.lng]}
                icon={createAnimatedIcon(selectedIcon)}
              />
            )}
          </MapContainer>

          {/* Distance overlay */}
          <div className="distance-overlay">
            <div className="distance-item">
              <span className="label">Traveled</span>
              <span className="value">{traveledDistance.toFixed(2)} km</span>
            </div>
            <div className="distance-item">
              <span className="label">Total</span>
              <span className="value">{totalDistance.toFixed(2)} km</span>
            </div>
            {isLoadingRoute && (
              <div className="distance-item">
                <span className="label">Route</span>
                <span className="value loading">Loading...</span>
              </div>
            )}
          </div>
        </div>

        <div className="controls-panel">
          {/* Search */}
          <div className="control-section">
            <h3>Search Place</h3>
            <div className="search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                placeholder="Search location..."
                className="search-input"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="search-btn"
              >
                {isSearching ? '...' : 'Go'}
              </button>
            </div>
          </div>

          {/* Icon selector */}
          <div className="control-section">
            <h3>Travel Mode</h3>
            <div className="icon-selector">
              {Object.entries(ICONS).map(([key, icon]) => (
                <button
                  key={key}
                  className={`icon-btn ${selectedIcon === key ? 'active' : ''}`}
                  onClick={() => setSelectedIcon(key)}
                  style={{ '--icon-color': icon.color }}
                  title={icon.name}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: icon.svg.replace('%23COLOR%', icon.color.replace('#', '%23'))
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Playback controls */}
          <div className="control-section">
            <h3>Animation</h3>
            <div className="playback-controls">
              <button
                onClick={handlePlay}
                disabled={waypoints.length < 2 || (isPlaying && !isPaused) || isLoadingRoute}
                className="control-btn play"
              >
                Play
              </button>
              <button
                onClick={handlePause}
                disabled={!isPlaying || isPaused}
                className="control-btn pause"
              >
                Pause
              </button>
              <button
                onClick={handleStop}
                disabled={!isPlaying && animationProgress === 0}
                className="control-btn stop"
              >
                Stop
              </button>
            </div>

            {/* Progress slider */}
            <div className="progress-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={animationProgress}
                onChange={handleProgressChange}
                className="progress-slider"
              />
              <span className="progress-text">{Math.round(animationProgress * 100)}%</span>
            </div>

            {/* Speed control */}
            <div className="speed-control">
              <label>Speed: {speed}x</label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="speed-slider"
              />
            </div>

            {/* Loop toggle */}
            <label className="loop-toggle">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              Loop animation
            </label>
          </div>

          {/* Elevation profile */}
          {elevationData.length > 0 && (
            <div className="control-section elevation-section">
              <h3>Elevation Profile</h3>
              <div className="elevation-chart">
                <svg viewBox="0 0 300 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="elevGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={ICONS[selectedIcon].color} stopOpacity="0.8"/>
                      <stop offset="100%" stopColor={ICONS[selectedIcon].color} stopOpacity="0.1"/>
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 0 80 ${elevationData.map((d, i) =>
                      `L ${(i / (elevationData.length - 1)) * 300} ${80 - (d.elevation / 200) * 80}`
                    ).join(' ')} L 300 80 Z`}
                    fill="url(#elevGradient)"
                  />
                  <path
                    d={`M ${elevationData.map((d, i) =>
                      `${(i / (elevationData.length - 1)) * 300} ${80 - (d.elevation / 200) * 80}`
                    ).join(' L ')}`}
                    fill="none"
                    stroke={ICONS[selectedIcon].color}
                    strokeWidth="2"
                  />
                  <line
                    x1={animationProgress * 300}
                    y1="0"
                    x2={animationProgress * 300}
                    y2="80"
                    stroke="#333"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="control-section actions">
            <button onClick={handleClear} className="action-btn clear">
              Clear Route
            </button>
            <button
              onClick={exportVideo}
              disabled={waypoints.length < 2 || isExporting}
              className="action-btn export"
            >
              {isExporting ? 'Exporting...' : 'Export Video'}
            </button>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Click on the map to add waypoints (click waypoint to remove), then animate your journey!</p>
      </footer>
    </div>
  )
}

export default App
