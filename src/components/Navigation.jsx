import {
  Files,
  LayoutGrid,
  FilePlus,
  Share2,
  MessageSquareQuote,
  ShieldAlert,
} from 'lucide-react'

const TOOLS = [
  {
    id: 'combine',
    title: 'ผสานไฟล์',
    sub: 'Combine',
    icon: Files,
    desc: 'รวมไฟล์ PDF หลายไฟล์เป็นไฟล์เดียว',
  },
  {
    id: 'organize',
    title: 'จัดหน้า',
    sub: 'Organize',
    icon: LayoutGrid,
    desc: 'หมุนหน้า สลับลำดับ และลบหน้าที่ไม่ต้องการ',
  },
  {
    id: 'create',
    title: 'สร้าง PDF',
    sub: 'Create',
    icon: FilePlus,
    desc: 'สร้างจากรูปภาพ หรือพิมพ์ข้อความใหม่',
  },
  {
    id: 'export',
    title: 'ส่งออก',
    sub: 'Export',
    icon: Share2,
    desc: 'แปลงเป็นภาพ (PNG/JPG) หรือดึงข้อความ (.txt)',
  },
  {
    id: 'comments',
    title: 'ใส่ข้อความ',
    sub: 'Add comments',
    icon: MessageSquareQuote,
    desc: 'แปะโน้ตหรือข้อความกำกับบนหน้า PDF',
  },
  {
    id: 'protect',
    title: 'ใส่รหัสผ่าน',
    sub: 'Protect',
    icon: ShieldAlert,
    desc: 'เข้ารหัสไฟล์ด้วยรหัสผ่านความปลอดภัยสูง',
  },
]

export default function Navigation({ activeTab, onSelectTab }) {
  return (
    <nav className="bg-slate-100/80 p-1.5 sm:p-2 rounded-2xl border border-slate-200/80 mb-6">
      {/* Mobile scrollable tabs / Desktop grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          const isActive = activeTab === tool.id

          return (
            <button
              key={tool.id}
              onClick={() => onSelectTab(tool.id)}
              className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl transition-all duration-150 min-h-[64px] sm:min-h-[72px] text-center select-none active:scale-95 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span className="text-xs sm:text-sm leading-tight">{tool.title}</span>
              <span
                className={`text-[10px] hidden sm:block ${
                  isActive ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {tool.sub}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
