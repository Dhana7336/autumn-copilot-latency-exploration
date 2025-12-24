
const AI_TO_HOTEL_MAP = {
  // Standard Room variations -> Bernard
  'standard': 'Bernard',
  'standardroom': 'Bernard',
  'standard room': 'Bernard',
  'basic': 'Bernard',
  'basicroom': 'Bernard',
  'basic room': 'Bernard',

  // Deluxe Room variations -> LaRua
  'deluxe': 'LaRua',
  'deluxeroom': 'LaRua',
  'deluxe room': 'LaRua',

  // Executive Suite variations -> Santiago
  'executive': 'Santiago',
  'executivesuite': 'Santiago',
  'executive suite': 'Santiago',

  // Premium Suite variations -> Pilar
  'premium': 'Pilar',
  'premiumsuite': 'Pilar',
  'premium suite': 'Pilar',

  // Presidential Suite variations -> Mariana
  'presidential': 'Mariana',
  'presidentialsuite': 'Mariana',
  'presidential suite': 'Mariana',
  'penthouse': 'Mariana',
  'penthousesuite': 'Mariana',

  // Direct mappings (already correct)
  'bernard': 'Bernard',
  'larua': 'LaRua',
  'santiago': 'Santiago',
  'pilar': 'Pilar',
  'mariana': 'Mariana',
};

// Reverse mapping: Hotel room types to AI terminology (for display purposes)
const HOTEL_TO_AI_MAP = {
  'Bernard': 'Standard Room',
  'LaRua': 'Deluxe Room',
  'Santiago': 'Executive Suite',
  'Pilar': 'Premium Suite',
  'Mariana': 'Presidential Suite',
};

/**
 * Normalize a room type string for comparison
 * @param {string} input - Room type string
 * @returns {string} - Normalized lowercase string without spaces
 */
function normalizeForComparison(input) {
  if (!input) return '';
  return input.toLowerCase().replace(/\s+/g, '').trim();
}

/**
 * Map AI/LLM room type terminology to actual hotel room type
 * @param {string} input - Room type from AI (e.g., "Standard Room", "deluxeroom")
 * @returns {string} - Actual hotel room type (e.g., "Bernard", "LaRua")
 */
function mapToHotelRoomType(input) {
  if (!input) return input;

  const normalized = normalizeForComparison(input);

  // Check direct mapping first
  if (AI_TO_HOTEL_MAP[normalized]) {
    return AI_TO_HOTEL_MAP[normalized];
  }

  // Check if input already is a hotel room type (case-insensitive)
  const hotelTypes = Object.values(AI_TO_HOTEL_MAP);
  const found = hotelTypes.find(t => normalizeForComparison(t) === normalized);
  if (found) {
    return found;
  }

  // Try partial matching as fallback
  for (const [key, value] of Object.entries(AI_TO_HOTEL_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Return original if no mapping found
  return input;
}

/**
 * Map hotel room type to AI-friendly display name
 * @param {string} hotelRoomType - Actual hotel room type (e.g., "Bernard")
 * @returns {string} - AI-friendly name (e.g., "Standard Room")
 */
function mapToAIDisplayName(hotelRoomType) {
  if (!hotelRoomType) return hotelRoomType;
  return HOTEL_TO_AI_MAP[hotelRoomType] || hotelRoomType;
}

/**
 * Check if two room type strings refer to the same room
 * @param {string} type1 - First room type
 * @param {string} type2 - Second room type
 * @returns {boolean} - True if they match
 */
function roomTypesMatch(type1, type2) {
  if (!type1 || !type2) return false;

  const hotel1 = mapToHotelRoomType(type1);
  const hotel2 = mapToHotelRoomType(type2);

  return normalizeForComparison(hotel1) === normalizeForComparison(hotel2);
}

/**
 * Get all variations of a room type for searching
 * @param {string} roomType - Any room type identifier
 * @returns {string[]} - Array of all possible variations
 */
function getAllVariations(roomType) {
  const hotelType = mapToHotelRoomType(roomType);
  const normalized = normalizeForComparison(hotelType);

  const variations = [hotelType, normalized];

  // Add AI name if it exists
  const aiName = HOTEL_TO_AI_MAP[hotelType];
  if (aiName) {
    variations.push(aiName);
    variations.push(normalizeForComparison(aiName));
  }

  // Add all keys that map to this hotel type
  for (const [key, value] of Object.entries(AI_TO_HOTEL_MAP)) {
    if (value === hotelType) {
      variations.push(key);
    }
  }

  return [...new Set(variations)];
}

module.exports = {
  mapToHotelRoomType,
  mapToAIDisplayName,
  roomTypesMatch,
  normalizeForComparison,
  getAllVariations,
  AI_TO_HOTEL_MAP,
  HOTEL_TO_AI_MAP,
};
