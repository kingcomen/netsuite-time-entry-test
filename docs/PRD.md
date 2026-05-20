# PRD — NetSuite Time Entry (Custom Record)

**เวอร์ชัน:** 1.0  
**วันที่:** 2026-05-20  
**ผู้เขียน:** Wichit Comen  
**สถานะ:** Draft  
**สภาพแวดล้อมทดสอบ:** NetSuite Sandbox `8158655-sb2`

---

## 1. ภาพรวม (Overview)

ระบบ **Time Entry** เป็น Custom Record ใน NetSuite สำหรับบันทึกชั่วโมงทำงานของพนักงานต่อโปรเจกต์ในแต่ละวัน  
เป้าหมายของ PRD นี้คือกำหนดขอบเขตการทดสอบ (POC) บน Sandbox ก่อน deploy ขึ้น Production

---

## 2. เป้าหมาย (Goals)

| # | เป้าหมาย |
|---|---|
| G1 | บันทึกชั่วโมงทำงานของพนักงานต่อวันได้ถูกต้อง |
| G2 | เชื่อมโยงกับ Employee และ Project record ของ NetSuite |
| G3 | รองรับการ query ผ่าน SuiteQL / Saved Search |
| G4 | Deploy ผ่าน SDF (SuiteCloud Development Framework) |

**นอกขอบเขต (Out of Scope):** การส่งอีเมลอัตโนมัติ, Approval workflow, การคำนวณเงินเดือน

---

## 3. ผู้ใช้งาน (Users)

| ผู้ใช้ | สิ่งที่ต้องการ |
|---|---|
| พนักงาน | บันทึก/แก้ไขชั่วโมงทำงานของตัวเอง |
| ผู้จัดการ | ดูรายงานชั่วโมงรวมต่อโปรเจกต์ |
| Admin | จัดการ record และ custom fields |

---

## 4. Custom Record Design

**Script ID:** `customrecord_time_entry`  
**Record Name:** Time Entry Test

### 4.1 Fields (5 ฟิลด์)

| # | Script ID | Label | Type | Required | หมายเหตุ |
|---|---|---|---|---|---|
| 1 | `custrecord_te_employee` | Employee | SELECT → Employee (-4) | ✓ | แสดงใน list view |
| 2 | `custrecord_te_work_date` | Work Date | DATE | ✓ | แสดงใน list view |
| 3 | `custrecord_te_hours` | Hours | FLOAT (min: 0) | ✓ | แสดงใน list view |
| 4 | `custrecord_te_project` | Project | SELECT → Job (-7) | — | แสดงใน list view |
| 5 | `custrecord_te_notes` | Notes | TEXTAREA | — | ไม่แสดงใน list view |

### 4.2 Business Rules

- `custrecord_te_hours` ต้องมากกว่า 0 และไม่เกิน 24
- ห้ามบันทึกซ้ำ: Employee + Work Date + Project เดิมในวันเดียวกัน *(Phase 2)*
- ถ้าไม่เลือก Project ให้ default เป็น "General / Admin"  *(Phase 2)*

---

## 5. User Stories

```
US-01  ในฐานะพนักงาน ฉันต้องการบันทึกชั่วโมงทำงานวันนี้ได้ง่ายๆ
US-02  ในฐานะผู้จัดการ ฉันต้องการดูชั่วโมงรวมของโปรเจกต์ได้ใน Saved Search
US-03  ในฐานะ Admin ฉันต้องการ deploy custom record ผ่าน SDF โดยไม่ต้อง manual
US-04  ในฐานะ Developer ฉันต้องการ query ข้อมูลผ่าน SuiteQL ได้
```

---

## 6. เกณฑ์รับมอบงาน (Acceptance Criteria)

### Phase 1 — POC บน Sandbox (scope ของ repo นี้)

- [ ] SDF deploy สำเร็จบน `8158655-sb2` โดยไม่มี error
- [ ] สร้าง Time Entry record ใหม่ได้จาก UI ครบ 5 fields
- [ ] Validation: บันทึกโดยไม่กรอก Employee หรือ Work Date → แสดง error
- [ ] Validation: กรอก Hours = 0 หรือค่าติดลบ → แสดง error
- [ ] List View แสดง Employee, Work Date, Hours, Project ถูกต้อง
- [ ] SuiteQL query คืนข้อมูลถูกต้อง (ดู Section 7)

### Phase 2 — Production Ready *(ไม่อยู่ใน scope นี้)*

- [ ] Duplicate check (Employee + Date + Project)
- [ ] Approval workflow
- [ ] Role-based access control

---

## 7. ตัวอย่าง SuiteQL

```sql
SELECT
    r.id,
    e.entityid      AS employee,
    r.custrecord_te_work_date,
    r.custrecord_te_hours,
    j.entityid      AS project,
    r.custrecord_te_notes
FROM customrecord_time_entry r
JOIN employee e ON e.id = r.custrecord_te_employee
LEFT JOIN job j  ON j.id = r.custrecord_te_project
WHERE r.isinactive = 'F'
ORDER BY r.custrecord_te_work_date DESC
```

---

## 8. โครงสร้าง SDF Project

```
time-entry-test/
├── docs/
│   └── PRD.md                              ← เอกสารนี้
├── src/
│   ├── manifest.xml
│   └── Objects/
│       └── customrecord_time_entry.xml     ← custom record + 5 fields
├── project.json                            ← defaultAuthId: 8158655-sb2
└── README.md
```

---

## 9. วิธี Deploy

```bash
# 1. Setup auth (ครั้งแรกเท่านั้น)
suitecloud account:setup -i
# เลือก auth ID: 8158655-sb2

# 2. Deploy
cd time-entry-test
suitecloud project:deploy

# 3. ตรวจสอบใน NetSuite
# Setup → Customization → Lists, Records, & Fields → Record Types
# → หา "Time Entry Test"
```

---

## 10. แผนการทดสอบ

| ขั้นตอน | วิธีทดสอบ | ผลที่คาดหวัง |
|---|---|---|
| Deploy | `suitecloud project:deploy` | Exit 0, ไม่มี error |
| Create record | สร้างผ่าน UI | บันทึกได้ครบ 5 fields |
| Mandatory validation | ส่งฟอร์มโดยไม่กรอก Employee | Error message |
| SuiteQL | รัน query ใน SuiteQL Editor | คืนแถวที่บันทึกไว้ |
| List view | เปิด list view ของ record type | เห็น Employee, Date, Hours, Project |
