import {
  Treemap,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { TreemapNode } from '@/services/ncdService'

interface NcdTreemapProps {
  data: TreemapNode
  isLoading?: boolean
}

// Color palette based on density (patient count)
function getTreemapColor(value: number, maxValue: number): string {
  const ratio = value / maxValue;
  if (ratio >= 0.8) return '#dc2626' // red - very high
  if (ratio >= 0.6) return '#f97316' // orange - high
  if (ratio >= 0.4) return '#eab308' // yellow - medium
  if (ratio >= 0.2) return '#84cc16' // lime - low
  return '#22c55e' // green - very low
}

// Recursively find max value in tree for color scaling
function findMaxValue(node: TreemapNode): number {
  if (!node.children || node.children.length === 0) {
    return node.value
  }
  const childMax = Math.max(...node.children.map(child => findMaxValue(child)))
  return Math.max(node.value, childMax)
}

// Transform tree data for Recharts Treemap - handle flat structure
function transformTreeData(
  node: TreemapNode,
  maxValue: number,
  parentKey: string = ''
): any[] {
  const key = `${parentKey}-${node.name}`.replace(/^-/, '');
  const color = node.children ? '#8884d8' : getTreemapColor(node.value, maxValue);

  const result: any[] = [];

  // Skip rendering this node if name is empty (synthetic parent)
  // but still process its children
  if (node.name !== '') {
    result.push({
      name: node.name,
      value: Math.max(node.value, 1),
      fill: color,
      key: key,
    });
  }

  // Only expand children if this is a parent node
  if (node.children && node.children.length > 0) {
    node.children.forEach((child, idx) => {
      result.push(
        ...transformTreeData(child, maxValue, `${key}-${idx}`)
      );
    });
  }

  return result;
}

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, fill } = props;

  // Don't render if too small
  if (width < 20 || height < 20) {
    return null;
  }

  // Show full name + count only for large blocks
  if (width > 120 && height > 60) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fill,
            stroke: '#fff',
            strokeWidth: 2,
            opacity: 0.9,
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 8}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
          //fontWeight="bold"
          fontFamily="'Sarabun', sans-serif"
        >
          {name}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontFamily="'Sarabun', sans-serif"
        >
          {value.toLocaleString()} ราย
        </text>
      </g>
    );
  }

  // Show only count for medium blocks
  if (width > 60 && height > 40) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fill,
            stroke: '#fff',
            strokeWidth: 2,
            opacity: 0.9,
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontFamily="'Sarabun', sans-serif"
         // fontWeight="bold"
        >
          {value.toLocaleString()} ราย
        </text>
      </g>
    );
  }

  // Minimal display for small blocks
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      style={{
        fill: fill,
        stroke: '#fff',
        strokeWidth: 1,
        opacity: 0.9,
      }}
    />
  );
};

export function NcdTreemap({ data, isLoading }: NcdTreemapProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 แผนผังความหนาแน่นผู้ป่วย</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            กำลังโหลดข้อมูล...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.children || data.children.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ไม่พบข้อมูล</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            ไม่มีข้อมูลผู้ป่วยที่จะแสดง
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = findMaxValue(data);
  const treemapData = transformTreeData(data, maxValue);

  return (
    <>

      {/* Treemap */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">
            📊 การกระจายตัวผู้ป่วยตามประเภทโรค/จังหวัด
          </CardTitle>
          <CardDescription>
            ขนาด = จำนวนผู้ป่วย | สี = ความหนาแน่น (แดง=มากที่สุด, เขียว=น้อยที่สุด)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={600} minWidth={0}>
            <Treemap
              data={treemapData}
              dataKey="value"
              stroke="#fff"
              fill="#8884d8"
              content={<CustomTreemapContent />}
            >
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontFamily: "'Sarabun', sans-serif",
                }}
                formatter={(value) => `${Number(value).toLocaleString()} ราย`}
              />
            </Treemap>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">คำอธิบายสี</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600 rounded"></div>
              <span className="text-sm text-muted-foreground">มากที่สุด (80%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-500 rounded"></div>
              <span className="text-sm text-muted-foreground">มาก (60-79%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-500 rounded"></div>
              <span className="text-sm text-muted-foreground">ปานกลาง (40-59%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-lime-500 rounded"></div>
              <span className="text-sm text-muted-foreground">น้อย (20-39%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-600 rounded"></div>
              <span className="text-sm text-muted-foreground">น้อยที่สุด (&lt;20%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
