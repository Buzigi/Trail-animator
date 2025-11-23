import { useState, useRef, useCallback, useEffect } from 'react'
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api'
import html2canvas from 'html2canvas'
import './App.css'
import hikerIcon from './hiker.png'

// Icon configurations for different travel modes
const ICONS = {
  hiker: {
    name: 'Hiker',
    color: '#2E7D32',
    iconUrl: hikerIcon,
    path: 'M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.19L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z'
  },
  bicycle: {
    name: 'Bicycle',
    color: '#F57C00',
    path: 'M5,18A3,3 0 0,1 2,15A3,3 0 0,1 5,12A3,3 0 0,1 8,15A3,3 0 0,1 5,18M5,10A5,5 0 0,0 0,15A5,5 0 0,0 5,20A5,5 0 0,0 10,15A5,5 0 0,0 5,10M14.5,6A1.5,1.5 0 0,1 13,4.5A1.5,1.5 0 0,1 14.5,3A1.5,1.5 0 0,1 16,4.5A1.5,1.5 0 0,1 14.5,6M16,11V8.5L12.5,12H9.5L8.5,14L10,15L12,12H14L18,8V11H16M19,18A3,3 0 0,1 16,15A3,3 0 0,1 19,12A3,3 0 0,1 22,15A3,3 0 0,1 19,18M19,10A5,5 0 0,0 14,15A5,5 0 0,0 19,20A5,5 0 0,0 24,15A5,5 0 0,0 19,10Z'
  },
  car: {
    name: 'Car',
    color: '#1565C0',
    path: 'M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z'
  },
  runner: {
    name: 'Runner',
    color: '#C62828',
    path: 'M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.19L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z'
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = { lat: 32.0853, lng: 34.7818 } // Tel Aviv

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
  const [elevationGain, setElevationGain] = useState(0)
  const [elevationLoss, setElevationLoss] = useState(0)
  const [currentElevation, setCurrentElevation] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [savedRoutes, setSavedRoutes] = useState([])
  const [routeName, setRouteName] = useState('')
  const [mapInstance, setMapInstance] = useState(null)
  const [mapType, setMapType] = useState('satellite')
  const [showVideoDialog, setShowVideoDialog] = useState(false)

  const animationRef = useRef(null)
  const mapRef = useRef(null)
  const lastTimeRef = useRef(null)
  const fileInputRef = useRef(null)

  // Load saved routes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trailAnimatorRoutes')
    if (saved) {
      setSavedRoutes(JSON.parse(saved))
    }
  }, [])

  // Calculate distance between two points
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

  // Calculate route stats when waypoints change
  useEffect(() => {
    if (waypoints.length < 2) {
      setTotalDistance(0)
      setElevationData([])
      setElevationGain(0)
      setElevationLoss(0)
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

    // Use elevation from GPX if available, otherwise fetch
    if (waypoints[0].elevation !== undefined) {
      const elevPoints = waypoints.map((w, i) => ({
        distance: distances[i],
        elevation: w.elevation
      }))
      setElevationData(elevPoints)

      // Calculate gain/loss
      let gain = 0, loss = 0
      for (let i = 1; i < waypoints.length; i++) {
        const diff = waypoints[i].elevation - waypoints[i-1].elevation
        if (diff > 0) gain += diff
        else loss += Math.abs(diff)
      }
      setElevationGain(Math.round(gain))
      setElevationLoss(Math.round(loss))
    } else {
      // Fetch elevation from Google Elevation API
      fetchElevation(waypoints, distances, total)
    }
  }, [waypoints])

  // Fetch elevation data
  const fetchElevation = async (points, distances, totalDist) => {
    if (!window.google || !window.google.maps) return

    const elevator = new window.google.maps.ElevationService()
    const path = points.map(p => ({ lat: p.lat, lng: p.lng }))

    try {
      const result = await elevator.getElevationAlongPath({
        path,
        samples: Math.min(512, points.length)
      })

      if (result.results) {
        const elevPoints = result.results.map((r, i) => ({
          distance: (i / (result.results.length - 1)) * totalDist,
          elevation: r.elevation
        }))
        setElevationData(elevPoints)

        let gain = 0, loss = 0
        for (let i = 1; i < result.results.length; i++) {
          const diff = result.results[i].elevation - result.results[i-1].elevation
          if (diff > 0) gain += diff
          else loss += Math.abs(diff)
        }
        setElevationGain(Math.round(gain))
        setElevationLoss(Math.round(loss))
      }
    } catch (error) {
      console.error('Elevation fetch failed:', error)
    }
  }

  // Parse GPX file
  const parseGPX = (gpxString) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(gpxString, 'text/xml')
    const trackPoints = doc.querySelectorAll('trkpt')
    const routePoints = doc.querySelectorAll('rtept')
    const points = trackPoints.length > 0 ? trackPoints : routePoints

    const waypts = []
    points.forEach(pt => {
      const lat = parseFloat(pt.getAttribute('lat'))
      const lng = parseFloat(pt.getAttribute('lon'))
      const eleNode = pt.querySelector('ele')
      const elevation = eleNode ? parseFloat(eleNode.textContent) : undefined

      waypts.push({ lat, lng, elevation })
    })

    return waypts
  }

  // Preload map tiles along the route for smooth playback
  const preloadRouteTiles = async (points, map) => {
    if (!map || points.length < 2) return

    // First show the full route
    const bounds = new window.google.maps.LatLngBounds()
    points.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }))
    map.fitBounds(bounds)

    // Wait for overview tiles to load
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Pan through key points at animation zoom level to preload detail tiles
    const animationZoom = 16
    const numSamples = Math.min(20, Math.floor(points.length / 10) + 1)
    const step = Math.floor(points.length / numSamples)

    for (let i = 0; i < points.length; i += step) {
      const point = points[i]
      map.panTo({ lat: point.lat, lng: point.lng })
      map.setZoom(animationZoom)
      // Wait for tiles to load
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Return to overview
    map.fitBounds(bounds)
    map.setTilt(45)
  }

  // Handle GPX file import
  const handleFileImport = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const gpxContent = e.target.result
      const points = parseGPX(gpxContent)

      if (points.length > 0) {
        setWaypoints(points)
        setRouteName(file.name.replace('.gpx', ''))

        // Preload map tiles along the route
        if (mapInstance && points.length > 0) {
          await preloadRouteTiles(points, mapInstance)
        }
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  // Handle map click
  const handleMapClick = useCallback(async (event) => {
    if (isPlaying) return

    const newWaypoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    }

    // Fetch elevation for the new waypoint
    if (window.google && window.google.maps) {
      const elevator = new window.google.maps.ElevationService()
      try {
        const result = await elevator.getElevationForLocations({
          locations: [{ lat: newWaypoint.lat, lng: newWaypoint.lng }]
        })
        if (result.results && result.results[0]) {
          newWaypoint.elevation = result.results[0].elevation
        }
      } catch (error) {
        console.error('Elevation fetch failed for waypoint:', error)
      }
    }

    setWaypoints(prev => [...prev, newWaypoint])
  }, [isPlaying])

  // Handle waypoint click to remove
  const handleWaypointClick = useCallback((index) => {
    if (isPlaying) return
    setWaypoints(prev => prev.filter((_, i) => i !== index))
  }, [isPlaying])

  // Interpolate position along path
  const getPositionAtProgress = useCallback((progress) => {
    if (waypoints.length < 2) return null

    const distances = [0]
    let totalDist = 0
    for (let i = 1; i < waypoints.length; i++) {
      const dist = calculateDistance(
        waypoints[i-1].lat, waypoints[i-1].lng,
        waypoints[i].lat, waypoints[i].lng
      )
      totalDist += dist
      distances.push(totalDist)
    }

    const targetDist = progress * totalDist

    for (let i = 1; i < distances.length; i++) {
      if (distances[i] >= targetDist) {
        const segmentStart = distances[i-1]
        const segmentEnd = distances[i]
        const segmentProgress = (targetDist - segmentStart) / (segmentEnd - segmentStart)

        const start = waypoints[i-1]
        const end = waypoints[i]

        const position = {
          lat: start.lat + (end.lat - start.lat) * segmentProgress,
          lng: start.lng + (end.lng - start.lng) * segmentProgress
        }

        return {
          position,
          segmentIndex: i - 1
        }
      }
    }

    const last = waypoints[waypoints.length - 1]
    return {
      position: { lat: last.lat, lng: last.lng },
      segmentIndex: waypoints.length - 1
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
      const increment = (deltaTime / 1000) * speed * 0.02
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

  // Update position, elevation, and camera
  useEffect(() => {
    const result = getPositionAtProgress(animationProgress)
    if (result) {
      const { position: pos, segmentIndex } = result
      setCurrentPosition(pos)
      setTraveledDistance(totalDistance * animationProgress)

      // Calculate traveled path - all points up to current segment + current position
      const traveled = waypoints.slice(0, segmentIndex + 1).map(w => ({ lat: w.lat, lng: w.lng }))
      traveled.push(pos)
      setTraveledPath(traveled)

      // Calculate current elevation
      if (elevationData.length > 1) {
        const currentDist = totalDistance * animationProgress
        for (let i = 1; i < elevationData.length; i++) {
          if (elevationData[i].distance >= currentDist) {
            const prev = elevationData[i - 1]
            const next = elevationData[i]
            const segmentProgress = (currentDist - prev.distance) / (next.distance - prev.distance)
            const elev = prev.elevation + (next.elevation - prev.elevation) * segmentProgress
            setCurrentElevation(Math.round(elev))
            break
          }
        }
      }

      // Cinematic camera follow with zoom
      if (mapInstance && isPlaying) {
        const zoomBase = 16
        const zoomEffect = Math.sin(animationProgress * Math.PI) * 1.5
        const targetZoom = zoomBase - zoomEffect * 0.3

        mapInstance.panTo(pos)
        mapInstance.setZoom(targetZoom)
        mapInstance.setTilt(60) // 3D tilt
      }
    }
  }, [animationProgress, getPositionAtProgress, totalDistance, elevationData, mapInstance, isPlaying, waypoints])

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
    setTraveledPath([])
    if (mapInstance) {
      mapInstance.setTilt(0)
    }
  }

  const handleProgressChange = (e) => {
    setAnimationProgress(parseFloat(e.target.value))
  }

  const handleClear = () => {
    handleStop()
    setWaypoints([])
    setTotalDistance(0)
    setTraveledDistance(0)
    setElevationData([])
    setElevationGain(0)
    setElevationLoss(0)
    setRouteName('')
  }

  // Save route
  const handleSaveRoute = () => {
    if (waypoints.length < 2) return

    const name = routeName.trim() || `Route ${new Date().toLocaleDateString()}`
    const newRoute = {
      id: Date.now(),
      name,
      waypoints,
      icon: selectedIcon,
      distance: totalDistance,
      elevationGain,
      elevationLoss,
      createdAt: new Date().toISOString()
    }

    const updatedRoutes = [...savedRoutes, newRoute]
    setSavedRoutes(updatedRoutes)
    localStorage.setItem('trailAnimatorRoutes', JSON.stringify(updatedRoutes))
    setRouteName('')
    alert(`Route "${name}" saved!`)
  }

  // Load route
  const handleLoadRoute = (route) => {
    handleClear()
    setWaypoints(route.waypoints)
    setSelectedIcon(route.icon)
    setRouteName(route.name)
  }

  // Delete route
  const handleDeleteRoute = (routeId) => {
    const updatedRoutes = savedRoutes.filter(r => r.id !== routeId)
    setSavedRoutes(updatedRoutes)
    localStorage.setItem('trailAnimatorRoutes', JSON.stringify(updatedRoutes))
  }

  // Export route as JSON
  const handleExportRoute = () => {
    if (waypoints.length < 2) return

    const routeData = {
      name: routeName || 'Unnamed Route',
      waypoints,
      icon: selectedIcon,
      distance: totalDistance,
      elevationGain,
      elevationLoss,
      elevationData,
      createdAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${routeName || 'route'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Video export - show dialog
  const handleVideoClick = () => {
    if (waypoints.length < 2) return
    setShowVideoDialog(true)
  }

  // Video export with orientation
  const exportVideo = async (orientation) => {
    setShowVideoDialog(false)
    if (waypoints.length < 2) return

    setIsExporting(true)

    try {
      // Set dimensions based on orientation
      const isHorizontal = orientation === 'horizontal'
      const width = isHorizontal ? 1920 : 1080
      const height = isHorizontal ? 1080 : 1920

      // Create offscreen canvas for video
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      // Set up MediaRecorder
      const stream = canvas.captureStream(30)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      })

      const chunks = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `trek-animation-${orientation}.webm`
        link.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
        setAnimationProgress(0)
      }

      mediaRecorder.start()

      // Capture frames
      const totalFrames = 300
      const frameDelay = 33 // ~30fps

      for (let i = 0; i <= totalFrames; i++) {
        setAnimationProgress(i / totalFrames)
        await new Promise(resolve => setTimeout(resolve, frameDelay))

        // Capture current map state
        const mapCanvas = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: true,
          width: mapRef.current.offsetWidth,
          height: mapRef.current.offsetHeight
        })

        // Draw to video canvas with proper scaling
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)

        // Calculate scaling to fit while maintaining aspect ratio
        const sourceAspect = mapCanvas.width / mapCanvas.height
        const targetAspect = width / height

        let drawWidth, drawHeight, drawX, drawY

        if (sourceAspect > targetAspect) {
          drawWidth = width
          drawHeight = width / sourceAspect
          drawX = 0
          drawY = (height - drawHeight) / 2
        } else {
          drawHeight = height
          drawWidth = height * sourceAspect
          drawX = (width - drawWidth) / 2
          drawY = 0
        }

        ctx.drawImage(mapCanvas, drawX, drawY, drawWidth, drawHeight)
      }

      // Stop recording
      mediaRecorder.stop()

    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed: ' + error.message)
      setIsExporting(false)
      setAnimationProgress(0)
    }
  }

  const onMapLoad = (map) => {
    setMapInstance(map)
    // Set initial map type to satellite
    map.setMapTypeId('satellite')
    // Set initial zoom first, then tilt (tilt requires higher zoom levels)
    map.setZoom(18)
    // Use setTimeout to ensure map type is applied before setting tilt
    setTimeout(() => {
      map.setTilt(45)
      map.setHeading(0)
    }, 100)
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID // Required for 3D tilt

  if (!apiKey) {
    return (
      <div className="api-key-error">
        <div className="error-card">
          <h2>Google Maps API Key Required</h2>
          <p>Add your API key to <code>.env</code>:</p>
          <code>VITE_GOOGLE_MAPS_API_KEY=your_key</code>
          <p style={{ marginTop: '15px', fontSize: '0.85rem' }}>
            Enable: Maps JavaScript API, Elevation API
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Trail Animator</h1>
        <p className="subtitle">Import GPX or click to create your journey</p>
      </header>

      <main className="main-content">
        <div className="map-container" ref={mapRef}>
          {waypoints.length > 0 ? (
            <LoadScript googleMapsApiKey={apiKey}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={waypoints[0]}
                zoom={18}
                onClick={handleMapClick}
                onLoad={onMapLoad}
                mapTypeId="satellite"
                options={{
                  mapId: mapId, // Required for 3D tilt - get from Google Cloud Console
                  mapTypeControl: true,
                  mapTypeControlOptions: {
                    mapTypeIds: ['roadmap', 'satellite', 'terrain', 'hybrid']
                  },
                  streetViewControl: false,
                  fullscreenControl: false,
                  rotateControl: true,
                  tilt: 45,
                  heading: 0,
                  gestureHandling: 'greedy'
                }}
              >
              {/* Trail path */}
              {waypoints.length > 1 && (
                <>
                  {/* Faint full path preview */}
                  {(isPlaying || animationProgress > 0) && (
                    <Polyline
                      path={waypoints}
                      options={{
                        strokeColor: ICONS[selectedIcon].color,
                        strokeOpacity: 0.2,
                        strokeWeight: 3
                      }}
                    />
                  )}
                  {/* Main path - progressive during animation, full when stopped */}
                  <Polyline
                    path={(isPlaying || animationProgress > 0) && traveledPath.length > 0 ? traveledPath : waypoints}
                    options={{
                      strokeColor: ICONS[selectedIcon].color,
                      strokeOpacity: 0.9,
                      strokeWeight: 4
                    }}
                  />
                </>
              )}

              {/* Start/End markers */}
              {waypoints.length > 0 && (
                <>
                  <Marker
                    position={waypoints[0]}
                    label={{ text: 'S', color: 'white', fontWeight: 'bold' }}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                      scale: 12,
                      fillColor: '#4CAF50',
                      fillOpacity: 1,
                      strokeColor: 'white',
                      strokeWeight: 2
                    }}
                    onClick={() => handleWaypointClick(0)}
                  />
                  {waypoints.length > 1 && (
                    <Marker
                      position={waypoints[waypoints.length - 1]}
                      label={{ text: 'E', color: 'white', fontWeight: 'bold' }}
                      icon={{
                        path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                        scale: 12,
                        fillColor: '#F44336',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2
                      }}
                      onClick={() => handleWaypointClick(waypoints.length - 1)}
                    />
                  )}
                </>
              )}

              {/* Animated icon */}
              {currentPosition && window.google?.maps?.Size && (
                <Marker
                  position={currentPosition}
                  icon={ICONS[selectedIcon].iconUrl ? {
                    url: ICONS[selectedIcon].iconUrl,
                    scaledSize: new window.google.maps.Size(40, 40),
                    anchor: new window.google.maps.Point(20, 20)
                  } : {
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
          ) : (
            <div className="map-placeholder">
              <div className="placeholder-content">
                <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
                  <path d="M14,6l-3.75,5l2.85,3.8l-1.6,1.2C9.81,13.75,7,10,7,10l-6,8h22L14,6z"/>
                </svg>
                <h2>Import a GPX File</h2>
                <p>Choose a GPX file to visualize your trail</p>
              </div>
            </div>
          )}

          {/* Stats overlay */}
          {waypoints.length > 0 && (
          <div className="distance-overlay">
            <div className="distance-item">
              <span className="label">Traveled</span>
              <span className="value">{traveledDistance.toFixed(2)} km</span>
            </div>
            <div className="distance-item">
              <span className="label">Total</span>
              <span className="value">{totalDistance.toFixed(2)} km</span>
            </div>
            {elevationData.length > 0 && (
              <div className="distance-item elevation-stat">
                <span className="label">Elevation</span>
                <span className="value current-elev">{currentElevation}m</span>
              </div>
            )}
            {elevationGain > 0 && (
              <>
                <div className="distance-item elevation-stat">
                  <span className="label">Ascent</span>
                  <span className="value gain">+{elevationGain}m</span>
                </div>
                <div className="distance-item elevation-stat">
                  <span className="label">Descent</span>
                  <span className="value loss">-{elevationLoss}m</span>
                </div>
              </>
            )}
          </div>
          )}
        </div>

        <div className="controls-panel">
          {/* GPX Import */}
          <div className="control-section">
            <h3>Import GPX</h3>
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileImport}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="import-btn"
            >
              Choose GPX File
            </button>
          </div>

          {/* Map Type */}
          <div className="control-section">
            <h3>Map Type</h3>
            <div className="map-type-selector">
              {['terrain', 'satellite', 'hybrid', 'roadmap'].map(type => (
                <button
                  key={type}
                  className={`map-type-btn ${mapType === type ? 'active' : ''}`}
                  onClick={() => setMapType(type)}
                  disabled={waypoints.length === 0}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
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
                  disabled={waypoints.length === 0}
                >
                  {icon.iconUrl ? (
                    <img src={icon.iconUrl} alt={icon.name} width="24" height="24" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path d={icon.path} fill="currentColor" />
                    </svg>
                  )}
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

            <div className="progress-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={animationProgress}
                onChange={handleProgressChange}
                className="progress-slider"
                disabled={waypoints.length === 0}
              />
              <span className="progress-text">{Math.round(animationProgress * 100)}%</span>
            </div>

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
                disabled={waypoints.length === 0}
              />
            </div>

            <label className="loop-toggle">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                disabled={waypoints.length === 0}
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
                    d={`M 0 80 ${elevationData.map((d, i) => {
                      const maxElev = Math.max(...elevationData.map(e => e.elevation))
                      const minElev = Math.min(...elevationData.map(e => e.elevation))
                      const range = maxElev - minElev || 1
                      return `L ${(i / (elevationData.length - 1)) * 300} ${80 - ((d.elevation - minElev) / range) * 70}`
                    }).join(' ')} L 300 80 Z`}
                    fill="url(#elevGradient)"
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

          {/* Actions */}
          <div className="control-section actions">
            <button
              onClick={handleClear}
              className="action-btn clear"
              disabled={waypoints.length === 0}
            >
              Clear
            </button>
            <button
              onClick={handleVideoClick}
              disabled={waypoints.length < 2 || isExporting}
              className="action-btn export"
            >
              {isExporting ? '...' : 'Video'}
            </button>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Import GPX from Garmin or click on map to add points</p>
      </footer>

      {/* Video orientation dialog */}
      {showVideoDialog && (
        <div className="video-dialog-overlay">
          <div className="video-dialog">
            <h3>Video Orientation</h3>
            <p>Choose the video format:</p>
            <div className="video-dialog-buttons">
              <button
                onClick={() => exportVideo('horizontal')}
                className="video-option-btn horizontal"
              >
                <span className="orientation-icon">&#9645;</span>
                <span>Horizontal</span>
                <small>Desktop (1920x1080)</small>
              </button>
              <button
                onClick={() => exportVideo('vertical')}
                className="video-option-btn vertical"
              >
                <span className="orientation-icon">&#9647;</span>
                <span>Vertical</span>
                <small>Mobile (1080x1920)</small>
              </button>
            </div>
            <button
              onClick={() => setShowVideoDialog(false)}
              className="video-dialog-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
