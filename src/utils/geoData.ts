// Thai Provinces Coordinates (Latitude, Longitude) - Central points
export const thaiProvinceCoordinates: Record<string, { lat: number; lng: number; name: string }> = {
  // Northern Region
  'เชียงใหม่': { lat: 18.7883, lng: 98.9853, name: 'เชียงใหม่' },
  'เชียงราย': { lat: 19.9121, lng: 99.8325, name: 'เชียงราย' },
  'แพร่': { lat: 18.1434, lng: 100.1162, name: 'แพร่' },
  'น่าน': { lat: 19.7755, lng: 100.7746, name: 'น่าน' },
  'พะเยา': { lat: 19.1922, lng: 101.3413, name: 'พะเยา' },
  'พิษณุโลก': { lat: 16.8271, lng: 100.2635, name: 'พิษณุโลก' },
  'สุโขทัย': { lat: 17.0104, lng: 99.8297, name: 'สุโขทัย' },
  'ตาก': { lat: 16.8849, lng: 99.1276, name: 'ตาก' },
  'ลำพูน': { lat: 18.5654, lng: 99.0069, name: 'ลำพูน' },
  'ลำปาง': { lat: 18.3185, lng: 99.4912, name: 'ลำปาง' },
  'อุตรดิตถ์': { lat: 17.6253, lng: 100.0994, name: 'อุตรดิตถ์' },

  // Northeastern Region
  'ขอนแก่น': { lat: 16.4413, lng: 102.8360, name: 'ขอนแก่น' },
  'อุดรธานี': { lat: 17.4131, lng: 102.7845, name: 'อุดรธานี' },
  'เลย': { lat: 17.4862, lng: 101.7258, name: 'เลย' },
  'หนองคาย': { lat: 17.8793, lng: 104.7710, name: 'หนองคาย' },
  'มหาสารคาม': { lat: 16.1865, lng: 103.3054, name: 'มหาสารคาม' },
  'ร้อยเอ็ด': { lat: 16.2421, lng: 104.0083, name: 'ร้อยเอ็ด' },
  'กาฬสินธุ์': { lat: 16.6827, lng: 103.5102, name: 'กาฬสินธุ์' },
  'สกลนคร': { lat: 17.1556, lng: 104.1351, name: 'สกลนคร' },
  'นครราชสีมา': { lat: 14.9732, lng: 102.0994, name: 'นครราชสีมา' },
  'บึงกาฬ': { lat: 16.4546, lng: 102.8168, name: 'บึงกาฬ' },
  'ยโสธร': { lat: 15.8079, lng: 104.1659, name: 'ยโสธร' },
  'อำนาจเจริญ': { lat: 16.0606, lng: 104.6224, name: 'อำนาจเจริญ' },
  'ศรีสะเกษ': { lat: 15.1195, lng: 104.3088, name: 'ศรีสะเกษ' },
  'สุรินทร์': { lat: 14.8823, lng: 104.9171, name: 'สุรินทร์' },
  'บุรีรัมย์': { lat: 14.9992, lng: 103.1045, name: 'บุรีรัมย์' },
  'ชัยภูมิ': { lat: 16.0708, lng: 101.9108, name: 'ชัยภูมิ' },
  'มุกดาหาร': { lat: 16.5354, lng: 104.7197, name: 'มุกดาหาร' },
  'อุบลราชธานี': { lat: 15.2488, lng: 104.8547, name: 'อุบลราชธานี' },
  'กำแพงแพร่': { lat: 16.2833, lng: 101.9167, name: 'กำแพงแพร่' },

  // Central Region
  'กรุงเทพมหานคร': { lat: 13.7563, lng: 100.5018, name: 'กรุงเทพมหานคร' },
  'เพชรบุรี': { lat: 12.8188, lng: 99.9344, name: 'เพชรบุรี' },
  'ประจวบคีรีขันธ์': { lat: 12.2278, lng: 99.8158, name: 'ประจวบคีรีขันธ์' },
  'ราชบุรี': { lat: 13.5291, lng: 99.8139, name: 'ราชบุรี' },
  'สมุทรสาคร': { lat: 12.8094, lng: 100.2729, name: 'สมุทรสาคร' },
  'สมุทรปราการ': { lat: 13.5910, lng: 100.9054, name: 'สมุทรปราการ' },
  'สมุทรสงคราม': { lat: 13.4072, lng: 100.0373, name: 'สมุทรสงคราม' },
  'นนทบุรี': { lat: 13.8629, lng: 100.5149, name: 'นนทบุรี' },
  'ปทุมธานี': { lat: 13.9263, lng: 100.5186, name: 'ปทุมธานี' },
  'ชลบุรี': { lat: 13.3672, lng: 100.9847, name: 'ชลบุรี' },
  'ระยอง': { lat: 12.6832, lng: 101.2447, name: 'ระยอง' },
  'จันทบุรี': { lat: 12.6112, lng: 102.1014, name: 'จันทบุรี' },
  'ตราด': { lat: 12.2410, lng: 102.5180, name: 'ตราด' },
  'นครนายก': { lat: 13.850, lng: 101.194, name: 'นครนายก' },
  'สระแก้ว': { lat: 13.828, lng: 102.029, name: 'สระแก้ว' },
  'สระบุรี': { lat: 14.5050, lng: 100.9123, name: 'สระบุรี' },
  'ชัยนาท': { lat: 15.1859, lng: 100.1241, name: 'ชัยนาท' },
  'นครสวรรค์': { lat: 15.6984, lng: 100.1269, name: 'นครสวรรค์' },
  'พิจิตร': { lat: 16.4475, lng: 100.3418, name: 'พิจิตร' },

  // Eastern Region
  'นครปฐม': { lat: 13.8163, lng: 100.0542, name: 'นครปฐม' },
  'สุพรรณบุรี': { lat: 14.4697, lng: 100.1225, name: 'สุพรรณบุรี' },
  'เพชรเบิร์ก': { lat: 14.3554, lng: 100.6392, name: 'เพชรเบิร์ก' },

  // Southern Region
  'ชุมพร': { lat: 8.4706, lng: 98.9843, name: 'ชุมพร' },
  'สุราษฎร์ธานี': { lat: 8.6135, lng: 98.8303, name: 'สุราษฎร์ธานี' },
  'นครศรีธรรมราช': { lat: 8.4304, lng: 100.1857, name: 'นครศรีธรรมราช' },
  'พังงา': { lat: 8.4484, lng: 98.5247, name: 'พังงา' },
  'ภูเก็ต': { lat: 7.8804, lng: 98.3923, name: 'ภูเก็ต' },
  'ระนอง': { lat: 9.2741, lng: 98.6297, name: 'ระนอง' },
  'สตูล': { lat: 6.6221, lng: 100.0741, name: 'สตูล' },
  'สงขลา': { lat: 7.1906, lng: 100.6087, name: 'สงขลา' },
  'ยะลา': { lat: 6.6274, lng: 101.2868, name: 'ยะลา' },
  'ตรัง': { lat: 7.5563, lng: 99.6082, name: 'ตรัง' },
  'ปัตตานี': { lat: 6.8345, lng: 101.2505, name: 'ปัตตานี' },
  'สัตหีบ': { lat: 12.8263, lng: 100.9813, name: 'สัตหีบ' },

  // Unknown/Default location (center of Thailand)
  'ไม่ระบุ': { lat: 15.8700, lng: 100.9925, name: 'ไม่ระบุ' },
};

// Extract province name from full address
export function extractProvinceName(address: string, fullThaiAddressMap?: Record<string, string>): string {
  if (!address) return 'ไม่ระบุ';

  // If we have a mapping table, use it
  if (fullThaiAddressMap) {
    return fullThaiAddressMap[address] || 'ไม่ระบุ';
  }

  // Try to extract from address string
  const words = address.split(' ');
  for (const word of words) {
    if (thaiProvinceCoordinates[word]) {
      return word;
    }
  }

  return 'ไม่ระบุ';
}

// Get coordinates for address
export function getCoordinatesForAddress(
  address: string,
  provinceName?: string
): { lat: number; lng: number } | null {
  const province = provinceName || extractProvinceName(address);
  return thaiProvinceCoordinates[province] || thaiProvinceCoordinates['ไม่ระบุ'];
}

// Group address data by province
export function groupAddressesByProvince(
  addresses: { address: string; count: number }[],
  provinceMap?: Record<string, string>
): Record<string, { addresses: string[]; totalCount: number; coordinates: { lat: number; lng: number } }> {
  const grouped: Record<string, { addresses: string[]; totalCount: number; coordinates: { lat: number; lng: number } }> = {};

  for (const item of addresses) {
    const province = extractProvinceName(item.address, provinceMap);
    const coords = getCoordinatesForAddress(item.address, province);

    if (!grouped[province]) {
      grouped[province] = {
        addresses: [],
        totalCount: 0,
        coordinates: coords || { lat: 15.8700, lng: 100.9925 },
      };
    }

    grouped[province].addresses.push(item.address);
    grouped[province].totalCount += item.count;
  }

  return grouped;
}
