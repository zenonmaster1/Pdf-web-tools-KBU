// Global project constants

// Maximum allowed file size in Megabytes (MB)
export const MAX_FILE_MB = 50

// Maximum allowed file size in Bytes
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

// Available PDF tools configuration
export const PDF_TOOLS = [
  {
    id: 'combine',
    path: '/tools/combine',
    title: 'ผสานไฟล์',
    subTitle: 'Combine',
    description: 'รวมไฟล์ PDF หลายไฟล์เข้าด้วยกันเป็นไฟล์เดียวตามลำดับที่ต้องการ',
    iconName: 'Files',
  },
  {
    id: 'organize',
    path: '/tools/organize',
    title: 'จัดหน้า',
    subTitle: 'Organize',
    description: 'สลับลำดับ หมุนหน้า หรือลบหน้าที่ไม่ต้องการออกจากเอกสาร',
    iconName: 'LayoutGrid',
  },
  {
    id: 'create',
    path: '/tools/create',
    title: 'สร้าง PDF',
    subTitle: 'Create',
    description: 'สร้างเอกสาร PDF จากรูปภาพหลายรูป หรือพิมพ์ข้อความขึ้นใหม่',
    iconName: 'FilePlus',
  },
  {
    id: 'export',
    path: '/tools/export',
    title: 'ส่งออก',
    subTitle: 'Export',
    description: 'แปลงหน้า PDF เป็นรูปภาพ หรือดึงข้อความทั้งหมดออกเป็นไฟล์ .txt',
    iconName: 'Share2',
  },
  {
    id: 'comments',
    path: '/tools/comments',
    title: 'ใส่ข้อความ',
    subTitle: 'Add comments',
    description: 'ใส่ความเห็น โน้ต หรือข้อความกำกับบนตำแหน่งที่ต้องการของหน้าเอกสาร',
    iconName: 'MessageSquarePlus',
  },
  {
    id: 'protect',
    path: '/tools/protect',
    title: 'ใส่รหัสผ่าน',
    subTitle: 'Protect',
    description: 'เข้ารหัสล็อกไฟล์ PDF ด้วยรหัสผ่านความปลอดภัยสูงเพื่อป้องกันการเปิดอ่าน',
    iconName: 'ShieldAlert',
  },
]
