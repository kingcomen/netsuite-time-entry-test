-- ============================================================
-- Time Entry Custom Record — SuiteQL Test Queries
-- Run in: NetSuite → Reports → SuiteQL Editor  (or via REST)
-- Account: teibto-sb2 (4089685_SB2)
-- ============================================================

-- TEST 1: ดึงทุก record (ตรวจว่า custom record ถูก deploy)
SELECT
    r.id,
    r.name,
    r.isinactive
FROM customrecord_time_entry r
ORDER BY r.id DESC;

-- ============================================================

-- TEST 2: ดึง records พร้อม join Employee + Project
SELECT
    r.id,
    e.entityid                      AS employee,
    r.custrecord_te_work_date       AS work_date,
    r.custrecord_te_hours           AS hours,
    j.entityid                      AS project,
    r.custrecord_te_notes           AS notes,
    r.lastmodified
FROM customrecord_time_entry r
JOIN employee e ON e.id = r.custrecord_te_employee
LEFT JOIN job j  ON j.id = r.custrecord_te_project
WHERE r.isinactive = 'F'
ORDER BY r.custrecord_te_work_date DESC;

-- ============================================================

-- TEST 3: รวมชั่วโมงต่อพนักงาน (weekly summary)
SELECT
    e.entityid                              AS employee,
    SUM(r.custrecord_te_hours)              AS total_hours,
    COUNT(r.id)                             AS entry_count
FROM customrecord_time_entry r
JOIN employee e ON e.id = r.custrecord_te_employee
WHERE r.isinactive = 'F'
GROUP BY e.entityid
ORDER BY total_hours DESC;

-- ============================================================

-- TEST 4: รวมชั่วโมงต่อ Project
SELECT
    COALESCE(j.entityid, '(No Project)')    AS project,
    SUM(r.custrecord_te_hours)              AS total_hours,
    COUNT(r.id)                             AS entry_count
FROM customrecord_time_entry r
LEFT JOIN job j ON j.id = r.custrecord_te_project
WHERE r.isinactive = 'F'
GROUP BY j.entityid
ORDER BY total_hours DESC;

-- ============================================================

-- TEST 5: ตรวจ validation — หา records ที่ hours <= 0 (ไม่ควรมี)
SELECT
    r.id,
    r.custrecord_te_hours,
    r.lastmodified
FROM customrecord_time_entry r
WHERE r.isinactive = 'F'
  AND (r.custrecord_te_hours <= 0 OR r.custrecord_te_hours > 24);
