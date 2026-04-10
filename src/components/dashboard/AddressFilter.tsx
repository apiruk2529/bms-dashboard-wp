import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { AreaInfo } from '@/services/kpiService'

interface AddressFilterProps {
  provinces: AreaInfo[]
  amphurs: AreaInfo[]
  tambons: AreaInfo[]
  villages: AreaInfo[]
  selectedChwpart: string
  selectedAmppart: string
  selectedTmbpart: string
  selectedMoopart: string[]
  onProvinceChange: (val: string) => void
  onAmphurChange: (val: string) => void
  onTambonChange: (val: string) => void
  onVillageChange: (vals: string[]) => void
  isLoading: boolean
}

export function AddressFilter({
  provinces,
  amphurs,
  tambons,
  villages,
  selectedChwpart,
  selectedAmppart,
  selectedTmbpart,
  selectedMoopart,
  onProvinceChange,
  onAmphurChange,
  onTambonChange,
  onVillageChange,
  isLoading
}: AddressFilterProps) {
  const [isMooOpen, setIsMooOpen] = useState(false)
  const mooRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mooRef.current && !mooRef.current.contains(event.target as Node)) {
        setIsMooOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleMoo = (code: string) => {
    if (selectedMoopart.includes(code)) {
      onVillageChange(selectedMoopart.filter(m => m !== code))
    } else {
      onVillageChange([...selectedMoopart, code])
    }
  }

  const selectAllMoo = () => {
    if (selectedMoopart.length === villages.length) {
      onVillageChange([])
    } else {
      onVillageChange(villages.map(v => v.code))
    }
  }

  return (
    <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-lg border shadow-sm text-sm">
      <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[160px]">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">จังหวัด</label>
        <select
          value={selectedChwpart}
          onChange={(e) => onProvinceChange(e.target.value)}
          disabled={isLoading}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">-- ทุกจังหวัด --</option>
          {provinces.map(p => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[160px]">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">อำเภอ</label>
        <select
          value={selectedAmppart}
          onChange={(e) => onAmphurChange(e.target.value)}
          disabled={!selectedChwpart || isLoading}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">-- ทุกอำเภอ --</option>
          {amphurs.map(a => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[160px]">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ตำบล</label>
        <select
          value={selectedTmbpart}
          onChange={(e) => onTambonChange(e.target.value)}
          disabled={!selectedAmppart || isLoading}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">-- ทุกตำบล --</option>
          {tambons.map(t => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[160px] relative" ref={mooRef}>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">หมู่บ้าน (Moo)</label>
        <button
          type="button"
          disabled={!selectedTmbpart || isLoading}
          onClick={() => setIsMooOpen(!isMooOpen)}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="truncate whitespace-nowrap">
            {selectedMoopart.length === 0
              ? '-- เลือกหมู่บ้าน --'
              : selectedMoopart.length === villages.length && villages.length > 0
              ? 'ทุกหมู่บ้าน'
              : `เลือกแล้ว ${selectedMoopart.length} หมู่บ้าน`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        {isMooOpen && villages.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full sm:w-64 bg-white border rounded-md shadow-lg py-1 max-h-64 overflow-auto">
            <div 
              className="px-3 py-2 text-xs font-medium border-b flex justify-between cursor-pointer hover:bg-slate-50 text-blue-600"
              onClick={selectAllMoo}
            >
              <span>เลือกทั้งหมด</span>
              <span>{selectedMoopart.length === villages.length ? 'ยกเลิก' : ''}</span>
            </div>
            {villages.map(v => {
              const isSelected = selectedMoopart.includes(v.code)
              return (
                <div
                  key={v.code}
                  className="flex items-center px-3 py-2 cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleMoo(v.code)}
                >
                  <div className={`flex items-center justify-center w-4 h-4 mr-2 border rounded ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground text-white" />}
                  </div>
                  <span>หมู่ {v.code} {v.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
