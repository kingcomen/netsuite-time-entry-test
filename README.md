# NetSuite Time Entry Test

POC ระบบ Time Entry บน NetSuite SDF ใช้ Custom Record สำหรับบันทึกชั่วโมงทำงานของพนักงานต่อโปรเจกต์

**สภาพแวดล้อม:** Sandbox `8158655-sb2`  
**SDF Framework:** Account Customization Project

---

## Custom Record

**Script ID:** `customrecord_time_entry` | **Record Name:** Time Entry Test

| Field | Script ID | Type | Required |
|---|---|---|---|
| Employee | `custrecord_te_employee` | SELECT → Employee | ✓ |
| Work Date | `custrecord_te_work_date` | DATE | ✓ |
| Hours | `custrecord_te_hours` | FLOAT | ✓ |
| Project | `custrecord_te_project` | SELECT → Job | — |
| Notes | `custrecord_te_notes` | TEXTAREA | — |

## Deploy

```bash
# Setup auth ครั้งแรก
suitecloud account:setup -i   # เลือก 8158655-sb2

# Deploy
suitecloud project:deploy
```

## โครงสร้างไฟล์

```
src/
├── manifest.xml
└── Objects/
    └── customrecord_time_entry.xml
project.json
docs/PRD.md
```

## เอกสาร

- [PRD — Product Requirements Document](docs/PRD.md)
