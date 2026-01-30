/**
 * SVG-based Room Renderer for Rain-Guessr
 * Uses precompiled map data for fast loading, with fallback to original method
 */

const RoomRenderer = {
  // Configuration
  TILE_SIZE: 15,
  TILE_TYPES: {
    '.': '#1a1a1a',
    '#': '#444',
    '|': '#666',
    '-': '#666',
    '+': '#888',
    '=': '#666',
    '/': '#555',
    'H': '#ff6600',
  },

  // Cache for loaded rooms
  roomsCache: {},
  regionPositions: {},
  allRooms: {}, // Store all loaded room data
  precompiledData: null, // Precompiled map data
  usePrecompiled: false, // Flag to use precompiled data

  /**
   * Initialize the renderer
   */
  async init() {
    console.log('Initializing Room Renderer...');
    try {
      // Try to load precompiled data first
      const precompiled = await this.loadPrecompiledData();
      
      if (precompiled && precompiled.rooms && Object.keys(precompiled.rooms).length > 0) {
        console.log('Using precompiled map data');
        this.usePrecompiled = true;
        this.precompiledData = precompiled;
        this.regionPositions = precompiled.regionPositions || {};
        this.allRooms = precompiled.rooms;
        console.log(`Precompiled data loaded: ${precompiled.totalRooms} rooms`);
        console.log(`Regions available: ${Object.keys(this.allRooms).join(', ')}`);
        return true;
      } else {
        console.log('Precompiled data is incomplete or empty');
      }
      
      // Fallback to original loading method
      console.log('Precompiled data not available, loading from files');
      this.usePrecompiled = false;
      await this.loadRegionPositions();
      await this.loadAllRoomMetadata();
      return true;
    } catch (error) {
      console.error('Failed to initialize Room Renderer:', error);
      return false;
    }
  },

  /**
   * Load precompiled map data
   */
  async loadPrecompiledData() {
    try {
      console.log('Attempting to fetch ../json/map-data.json');
      const response = await fetch('../json/map-data.json');
      console.log('Fetch response received, status:', response.status);
      
      if (!response.ok) {
        console.log('Precompiled data not found, status:', response.status);
        return null;
      }

      const data = await response.json();
      console.log(`Loaded precompiled data: ${data.totalRooms} rooms`);
      return data;
    } catch (error) {
      console.error('Error loading precompiled data:', error);
      console.error('Error details:', error.message, error.stack);
      return null;
    }
  },

  /**
   * Load region positions from file
   */
  async loadRegionPositions() {
    try {
      const response = await fetch('../map/World/Regions/Rooms/region_pos.txt');
      if (!response.ok) throw new Error('Failed to load region_pos.txt');

      const text = await response.text();
      const lines = text.split('\n').filter(l => l.trim());

      this.regionPositions = {};
      for (const line of lines) {
        const [region, coords] = line.split(':');
        if (region && coords) {
          const [x, y] = coords.match(/-?\d+/g) || [0, 0];
          this.regionPositions[region.trim()] = {
            x: parseInt(x),
            y: parseInt(y),
            name: region.trim()
          };
        }
      }

      console.log('Region positions loaded:', this.regionPositions);
      return this.regionPositions;
    } catch (error) {
      console.error('Error loading region positions:', error);
      throw error;
    }
  },

  /**
   * Load metadata for all rooms (just the list of rooms per region)
   */
  async loadAllRoomMetadata() {
    try {
      const response = await fetch('../map/World/Regions/Rooms/regions.txt');
      if (!response.ok) throw new Error('Failed to load regions.txt');

      const regions = (await response.text())
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean);

      console.log('Regions found:', regions);

      // Load room list for each region in parallel
      await Promise.all(regions.map(region => this.loadRegionRoomList(region)));
      
      return this.allRooms;
    } catch (error) {
      console.error('Error loading room metadata:', error);
      throw error;
    }
  },

  /**
   * Load the list of rooms for a specific region
   */
  async loadRegionRoomList(region) {
    try {
      // Convert region folder name (e.g., "CC-rooms") to region code (e.g., "CC")
      const regionCode = region.replace('-rooms', '');
      const fileToLoad = `../map/World/Regions/Rooms/${region}/cf-${regionCode}-rooms.txt`;

      const response = await fetch(fileToLoad);
      if (!response.ok) {
        console.warn(`Could not load room list for ${region}`);
        this.allRooms[regionCode] = [];
        return;
      }

      const roomNames = (await response.text())
        .split('\n')
        .map(r => r.trim())
        .filter(r => r && !r.startsWith('cf-')); // Filter out list filenames

      this.allRooms[regionCode] = roomNames;
      console.log(`Loaded ${roomNames.length} rooms for ${regionCode}`);
    } catch (error) {
      console.warn(`Error loading room list for ${region}:`, error);
      this.allRooms[region.replace('-rooms', '')] = [];
    }
  },

  /**
   * Load a single room's geometry
   */
  async loadRoomGeometry(regionCode, roomName) {
    const cacheKey = `${regionCode}_${roomName}`;
    
    // Return from cache if available
    if (this.roomsCache[cacheKey]) {
      return this.roomsCache[cacheKey];
    }

    try {
      // Room name may already include .txt, so we need to handle that
      const cleanRoomName = roomName.endsWith('.txt') ? roomName.slice(0, -4) : roomName;
      const filePath = `../map/World/Regions/Rooms/${regionCode}-rooms/${cleanRoomName}.txt`;
      const response = await fetch(filePath);
      
      if (!response.ok) {
        console.warn(`Could not load room: ${filePath}`);
        return null;
      }

      const text = await response.text();
      const roomData = this.parseRoomFile(text, regionCode, cleanRoomName);
      
      // Cache the parsed room
      this.roomsCache[cacheKey] = roomData;
      return roomData;
    } catch (error) {
      console.warn(`Error loading room geometry for ${regionCode}/${roomName}:`, error);
      return null;
    }
  },

  /**
   * Parse room file content
   */
  parseRoomFile(fileContent, regionCode, roomName) {
    const lines = fileContent.split('\n');
    let roomData = {
      name: roomName.toUpperCase(),
      regionCode: regionCode,
      width: 0,
      height: 0,
      position: { x: 0, y: 0 },
      tiles: [],
      geometry: []
    };

    let geometryStarted = false;
    let tileLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse room name
      if (trimmed.startsWith('Piece :')) {
        roomData.fullName = trimmed.replace('Piece :', '').trim();
      }

      // Parse size
      else if (/^\d+x\d+$/.test(trimmed)) {
        const [w, h] = trimmed.split('x').map(Number);
        roomData.width = w;
        roomData.height = h;
      }

      // Parse position
      else if (/^-?\d+x-?\d+$/.test(trimmed)) {
        const [x, y] = trimmed.match(/-?\d+/g).map(Number);
        roomData.position = { x, y };
      }

      // Collect tile lines (the ASCII map)
      else if (!geometryStarted && (trimmed.match(/^[.#|+\-=HV\/]/))) {
        tileLines.push(line);
      }

      // Parse geometry connections (lines with parentheses and pipes)
      else if (trimmed.includes('(') && trimmed.includes('|')) {
        roomData.geometry.push(trimmed);
        geometryStarted = true;
      }

      // Stop at end marker
      else if (trimmed === 'end file : ' + roomData.fullName) {
        break;
      }
    }

    // Store the tile map
    roomData.tileMap = tileLines;
    return roomData;
  },

  /**
   * Render room geometry to a canvas image (room outline only)
   */
  renderRoomToCanvas(roomData) {
    if (!roomData || !roomData.width || !roomData.height) {
      return null;
    }

    const width = roomData.width * this.TILE_SIZE;
    const height = roomData.height * this.TILE_SIZE;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    // Draw only the room border with thicker line
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);

    return canvas;
  },

  /**
   * Render a single room to SVG as an image element
   */
  renderRoomToSVG(roomData, svgGroup) {
    if (!roomData || !roomData.width || !roomData.height) {
      console.warn('Invalid room data:', roomData);
      return null;
    }

    // Get world position
    let worldX, worldY;
    
    if (this.usePrecompiled && roomData.worldPos) {
      // Use precompiled world position
      worldX = roomData.worldPos.x;
      worldY = roomData.worldPos.y;
    } else {
      // Calculate from region position and room position
      const regionPos = this.regionPositions[roomData.regionCode];
      if (!regionPos) {
        console.warn(`No position data for region ${roomData.regionCode}`);
        return null;
      }
      worldX = (regionPos.x + roomData.position.x) * this.TILE_SIZE;
      worldY = (regionPos.y + roomData.position.y) * this.TILE_SIZE;
    }

    // Render to canvas
    const canvas = this.renderRoomToCanvas(roomData);
    if (!canvas) return null;

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');

    // Create a group for this room
    const roomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    roomGroup.setAttribute('class', 'room-group');
    roomGroup.setAttribute('data-room', roomData.fullName || roomData.name);
    roomGroup.setAttribute('data-region', roomData.regionCode);
    roomGroup.setAttribute('data-pos-x', worldX);
    roomGroup.setAttribute('data-pos-y', worldY);
    roomGroup.setAttribute('data-width', canvas.width);
    roomGroup.setAttribute('data-height', canvas.height);

    // Create image element
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('x', worldX.toString());
    image.setAttribute('y', worldY.toString());
    image.setAttribute('width', canvas.width.toString());
    image.setAttribute('height', canvas.height.toString());
    image.setAttribute('href', dataUrl);
    image.setAttribute('class', 'room-image');
    roomGroup.appendChild(image);

    // Add invisible rect for hit detection
    const hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hitRect.setAttribute('x', worldX.toString());
    hitRect.setAttribute('y', worldY.toString());
    hitRect.setAttribute('width', canvas.width.toString());
    hitRect.setAttribute('height', canvas.height.toString());
    hitRect.setAttribute('fill', 'transparent');
    hitRect.setAttribute('class', 'room-hit-area');
    roomGroup.appendChild(hitRect);

    // Add room label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', (worldX + canvas.width / 2).toString());
    label.setAttribute('y', (worldY + canvas.height / 2).toString());
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dy', '0.3em');
    label.setAttribute('fill', '#0f0');
    label.setAttribute('font-size', '12');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('class', 'room-label');
    label.setAttribute('pointer-events', 'none');
    label.textContent = roomData.name || (roomData.fullName && roomData.fullName.split('_')[1]) || '';
    roomGroup.appendChild(label);

    // Add to SVG
    if (svgGroup) {
      svgGroup.appendChild(roomGroup);
    }

    return roomGroup;
  },

  /**
   * Render all rooms for a region (with limited parallelism to avoid blocking)
   */
  async renderRegion(regionCode, svgGroup) {
    console.log(`Rendering region ${regionCode}...`);
    
    // Get rooms for this region
    const roomsData = this.allRooms[regionCode] || [];
    
    if (roomsData.length === 0) {
      console.log(`No rooms found for region ${regionCode}`);
      return 0;
    }

    let renderedCount = 0;
    const batchSize = 50; // Render 50 rooms at a time (now that rendering is very fast)

    // Process rooms in batches
    for (let i = 0; i < roomsData.length; i += batchSize) {
      const batch = roomsData.slice(i, i + batchSize);
      
      // Render batch in parallel
      const renderPromises = batch.map(async (roomData) => {
        try {
          if (roomData && roomData.width > 0 && roomData.height > 0) {
            this.renderRoomToSVG(roomData, svgGroup);
            return 1;
          }
        } catch (error) {
          console.warn(`Error rendering ${regionCode}/${roomData.name}:`, error);
        }
        return 0;
      });

      const results = await Promise.all(renderPromises);
      renderedCount += results.reduce((sum, val) => sum + val, 0);
      
      // Allow UI to update between batches (less frequent now)
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    console.log(`Rendered ${renderedCount} rooms for ${regionCode}`);
    return renderedCount;
  },

  /**
   * Render all available regions (with limited parallelism to prevent blocking)
   */
  async renderAllRegions(svgGroup) {
    console.log('Rendering all regions...');
    const regions = Object.keys(this.allRooms);
    
    // Render all 11 regions in parallel now that data is lightweight
    let totalRooms = 0;

    const regionBatch = regions.slice(0, 11); // All regions at once
    
    // Render all regions in parallel
    const renderPromises = regionBatch.map(region => this.renderRegion(region, svgGroup));
    const counts = await Promise.all(renderPromises);
    
    totalRooms += counts.reduce((sum, count) => sum + count, 0);

    console.log(`Total rooms rendered: ${totalRooms}`);
    return totalRooms;
  },

  /**
   * Get room info by coordinates
   */
  getRoomAtPoint(x, y, svgGroup) {
    if (!svgGroup) return null;

    const rooms = svgGroup.querySelectorAll('.room-group');
    for (const room of rooms) {
      const roomX = parseInt(room.getAttribute('data-pos-x'));
      const roomY = parseInt(room.getAttribute('data-pos-y'));
      const roomW = parseInt(room.getAttribute('data-width'));
      const roomH = parseInt(room.getAttribute('data-height'));
      
      if (x >= roomX && y >= roomY && x < roomX + roomW && y < roomY + roomH) {
        return {
          name: room.getAttribute('data-room'),
          region: room.getAttribute('data-region'),
          x: roomX,
          y: roomY,
          svgElement: room
        };
      }
    }
    return null;
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RoomRenderer;
}

