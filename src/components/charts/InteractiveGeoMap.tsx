import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PatientAddressDistribution } from '@/services/ncdService'
import { groupAddressesByProvince } from '@/utils/geoData'

interface InteractiveGeoMapProps {
  data: PatientAddressDistribution[]
  isLoading?: boolean
}

// Color function based on density
function getColorByDensity(count: number, maxCount: number): string {
  const ratio = count / maxCount;
  if (ratio >= 0.8) return '#dc2626'; // red
  if (ratio >= 0.6) return '#f97316'; // orange
  if (ratio >= 0.4) return '#eab308'; // yellow
  if (ratio >= 0.2) return '#84cc16'; // lime
  return '#22c55e'; // green
}

export function InteractiveGeoMap({ data, isLoading }: InteractiveGeoMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersGroup = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (isLoading || !data || data.length === 0 || !mapContainer.current) {
      return;
    }

    // Clear old map if exists
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    // Initialize map centered on Thailand
    map.current = L.map(mapContainer.current).setView([15.8700, 100.9925], 5);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Group data by province
    const grouped = groupAddressesByProvince(data);
    const maxCount = Math.max(...Object.values(grouped).map(g => g.totalCount));

    // Create markers
    markersGroup.current = L.featureGroup().addTo(map.current);

    for (const [province, groupData] of Object.entries(grouped)) {
      if (groupData.coordinates) {
        const { lat, lng } = groupData.coordinates;
        const count = groupData.totalCount;
        const color = getColorByDensity(count, maxCount);
        
        // Circle size based on count (minimum 10px, maximum 40px)
        const radius = Math.max(10, Math.min(40, (count / maxCount) * 40));

        // Create circle marker
        const circle = L.circleMarker([lat, lng], {
          radius: radius,
          fillColor: color,
          color: '#333',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.85,
        });

        // Create popup content
        const popupContent = `
          <div style="font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937; font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${province}
            </h3>
            <hr style="margin: 8px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <div style="font-size: 13px; color: #4b5563; line-height: 1.6; font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="margin-bottom: 6px;">
                <strong style="color: #1f2937;">จำนวนผู้ป่วย:</strong> 
                <span style="color: #dc2626; font-weight: 600;">${count.toLocaleString()} ราย</span>
              </div>
              <div style="margin-bottom: 6px;">
                <strong style="color: #1f2937;">พื้นที่:</strong> ${groupData.addresses.length}
              </div>
              <div style="margin-top: 8px; font-size: 12px; background-color: #f3f4f6; padding: 6px; border-radius: 4px; color: #6b7280; max-height: 100px; overflow-y: auto; font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <strong style="display: block; margin-bottom: 4px; color: #374151;">ที่ตั้ง:</strong>
                ${groupData.addresses.map(a => `<div>${a}</div>`).join('')}
              </div>
            </div>
          </div>
        `;

        circle.bindPopup(popupContent, { maxWidth: 300, maxHeight: 300 });
        
        // Tooltip on hover
        circle.bindTooltip(`${province}: ${count.toLocaleString()} ราย`, { 
          permanent: false, 
          direction: 'top',
          offset: [0, -radius - 5]
        });

        circle.addTo(markersGroup.current);

        // Highlight on hover
        circle.on('mouseover', function(this: L.CircleMarker) {
          this.setStyle({
            weight: 3,
            opacity: 1,
            fillOpacity: 0.95,
          });
        });

        circle.on('mouseout', function(this: L.CircleMarker) {
          this.setStyle({
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.85,
          });
        });
      }
    }

    // Add legend
    class Legend extends L.Control {
      onAdd() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        div.style.fontSize = '12px';
        div.style.fontFamily = "'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        
        const labels = [
          { color: '#dc2626', label: 'มาก (80%+)' },
          { color: '#f97316', label: 'ค่อนข้างมาก (60-79%)' },
          { color: '#eab308', label: 'ปานกลาง (40-59%)' },
          { color: '#84cc16', label: 'ค่อนข้างน้อย (20-39%)' },
          { color: '#22c55e', label: 'น้อย (<20%)' },
        ];

        let html = '<div style="margin-bottom: 8px; font-weight: 600; color: #1f2937; font-family: \'Sarabun\', \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;">ความหนาแน่นผู้ป่วย</div>';
        
        labels.forEach(item => {
          html += `
            <div style="display: flex; align-items: center; margin-bottom: 6px; font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="
                width: 20px; 
                height: 20px; 
                background-color: ${item.color}; 
                border: 1px solid #333;
                border-radius: 50%; 
                margin-right: 8px;
              "></div>
              <span style="color: #374151; font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${item.label}</span>
            </div>
          `;
        });

        div.innerHTML = html;
        return div;
      }
    }

    const legend = new Legend({ position: 'bottomright' });
    legend.addTo(map.current);

    // Fit bounds to markers
    if (markersGroup.current && markersGroup.current.getLayers().length > 0) {
      map.current.fitBounds(markersGroup.current.getBounds(), { padding: [50, 50] });
    }

    return () => {
      // Cleanup on unmount
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [data, isLoading]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">แผนที่ความหนาแน่นเชิงพื้นที่</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            กำลังโหลดแผนที่...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ไม่พบข้อมูล</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            ไม่มีข้อมูลผู้ป่วยที่จะแสดงบนแผนที่
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">
          📍 แผนที่ความหนาแน่นเชิงพื้นที่
        </CardTitle>
        <CardDescription>
          การกระจายตัวของผู้ป่วยเบาหวาน/ความดันสูงตามพื้นที่ทั่วประเทศ | คลิกบน marker เพื่อดูรายละเอียด
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div
          ref={mapContainer}
          className="w-full rounded-lg overflow-hidden border border-slate-200"
          style={{ height: '500px', minHeight: '400px' }}
        />
      </CardContent>
    </Card>
  );
}
