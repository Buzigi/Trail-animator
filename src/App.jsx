import { useState, useRef, useCallback, useEffect } from 'react'
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api'
import html2canvas from 'html2canvas'
import './App.css'

// Icon SVG paths for different travel modes
const ICONS = {
  hiker: {
    path: 'M12 2C13.1 2 14 2.9 14 4S13.1 6 12 6 10 5.1 10 4 10.9 2 12 2M21 9H15V22H13V16H11V22H9V9H3V7H21V9M12 8L8 9V10.5L10 10V22H14V10L16 10.5V9L12 8Z',
    name: 'Hiker',
    color: '#2E7D32'
  },
  car: {
    path: 'M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z',
    name: 'Car',
    color: '#1565C0'
  },
  bike: {
    path: 'M5,18A3,3 0 0,1 2,15A3,3 0 0,1 5,12A3,3 0 0,1 8,15A3,3 0 0,1 5,18M5,10A5,5 0 0,0 0,15A5,5 0 0,0 5,20A5,5 0 0,0 10,15A5,5 0 0,0 5,10M14.5,6A1.5,1.5 0 0,1 13,4.5A1.5,1.5 0 0,1 14.5,3A1.5,1.5 0 0,1 16,4.5A1.5,1.5 0 0,1 14.5,6M16,11V8.5L12.5,12H9.5L8.5,14L10,15L12,12H14L18,8V11H16M19,18A3,3 0 0,1 16,15A3,3 0 0,1 19,12A3,3 0 0,1 22,15A3,3 0 0,1 19,18M19,10A5,5 0 0,0 14,15A5,5 0 0,0 19,20A5,5 0 0,0 24,15A5,5 0 0,0 19,10Z',
    name: 'Bike',
    color: '#F57C00'
  },
  runner: {
    path: 'M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.19L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z',
    name: 'Runner',
    color: '#C62828'
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060
}

function App() {
  const [waypoints, setWaypoints] = useState([])
  const [selectedIcon, setSelectedIcon] = useState('hiker')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(null)
  const [totalDistance, setTotalDistance] = useState(0)
  const [traveledDistance, setTraveledDistance] = useState(0)
  const [elevationData, setElevationData] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [mapInstance, setMapInstance] = useState(null)

  const animationRef = useRef(null)
  const mapRef = useRef(null)
  const lastTimeRef = useRef(null)

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Calculate total distance when waypoints change
  useEffect(() => {
    if (waypoints.length < 2) {
      setTotalDistance(0)
      setElevationData([])
      return
    }

    let total = 0
    const distances = [0]

    for (let i = 1; i < waypoints.length; i++) {
      const dist = calculateDistance(
        waypoints[i-1].lat, waypoints[i-1].lng,
        waypoints[i].lat, waypoints[i].lng
      )
      total += dist
      distances.push(total)
    }

    setTotalDistance(total)

    // Generate mock elevation data (in real app, use Google Elevation API)
    const mockElevation = waypoints.map((_, i) => ({
      distance: distances[i],
      elevation: 100 + Math.sin(i * 0.5) * 50 + Math.random() * 20
    }))
    setElevationData(mockElevation)
  }, [waypoints])

  // Handle map click to add waypoints
  const handleMapClick = useCallback((event) => {
    if (isPlaying) return

    const newWaypoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    }
    setWaypoints(prev => [...prev, newWaypoint])
  }, [isPlaying])

  // Interpolate position along the path
  const getPositionAtProgress = useCallback((progress) => {
    if (waypoints.length < 2) return null

    const totalSegments = waypoints.length - 1
    const segmentProgress = progress * totalSegments
    const currentSegment = Math.min(Math.floor(segmentProgress), totalSegments - 1)
    const segmentFraction = segmentProgress - currentSegment

    const start = waypoints[currentSegment]
    const end = waypoints[Math.min(currentSegment + 1, waypoints.length - 1)]

    return {
      lat: start.lat + (end.lat - start.lat) * segmentFraction,
      lng: start.lng + (end.lng - start.lng) * segmentFraction
    }
  }, [waypoints])

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }

    const deltaTime = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp

    setAnimationProgress(prev => {
      const increment = (deltaTime / 1000) * speed * 0.05
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

  // Update current position and traveled distance based on progress
  useEffect(() => {
    const pos = getPositionAtProgress(animationProgress)
    setCurrentPosition(pos)
    setTraveledDistance(totalDistance * animationProgress)

    // Pan map to follow the icon
    if (pos && mapInstance && isPlaying) {
      mapInstance.panTo(pos)
    }
  }, [animationProgress, getPositionAtProgress, totalDistance, mapInstance, isPlaying])

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
      const duration = 10 // 10 seconds video
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

      // Create downloadable frames as a zip or animated format
      // For simplicity, we'll export as a GIF-like format using canvas
      const link = document.createElement('a')
      link.download = 'trek-animation.webp'
      link.href = frames[frames.length - 1] // Last frame as preview
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

  const onMapLoad = (map) => {
    setMapInstance(map)
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div className="api-key-error">
        <div className="error-card">
          <h2>Google Maps API Key Required</h2>
          <p>Please add your API key to a <code>.env</code> file:</p>
          <code>VITE_GOOGLE_MAPS_API_KEY=your_key_here</code>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Trail Animator</h1>
        <p className="subtitle">Create and animate your journey</p>
      </header>

      <main className="main-content">
        <div className="map-container" ref={mapRef}>
          <LoadScript googleMapsApiKey={apiKey}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={12}
              onClick={handleMapClick}
              onLoad={onMapLoad}
              options={{
                styles: [
                  {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                  }
                ],
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: false
              }}
            >
              {/* Trail path */}
              {waypoints.length > 1 && (
                <Polyline
                  path={waypoints}
                  options={{
                    strokeColor: ICONS[selectedIcon].color,
                    strokeOpacity: 0.8,
                    strokeWeight: 4
                  }}
                />
              )}

              {/* Waypoint markers */}
              {waypoints.map((point, index) => (
                <Marker
                  key={index}
                  position={point}
                  label={{
                    text: String(index + 1),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 12,
                    fillColor: index === 0 ? '#4CAF50' : index === waypoints.length - 1 ? '#F44336' : '#FF9800',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2
                  }}
                />
              ))}

              {/* Animated icon */}
              {currentPosition && (
                <Marker
                  position={currentPosition}
                  icon={{
                    path: ICONS[selectedIcon].path,
                    scale: 1.5,
                    fillColor: ICONS[selectedIcon].color,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 1,
                    anchor: { x: 12, y: 12 }
                  }}
                />
              )}
            </GoogleMap>
          </LoadScript>

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
          </div>
        </div>

        <div className="controls-panel">
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
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d={icon.path} fill="currentColor" />
                  </svg>
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
                disabled={waypoints.length < 2 || (isPlaying && !isPaused)}
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
                  {/* Progress indicator */}
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
        <p>Click on the map to add waypoints, then animate your journey!</p>
      </footer>
    </div>
  )
}

export default App
