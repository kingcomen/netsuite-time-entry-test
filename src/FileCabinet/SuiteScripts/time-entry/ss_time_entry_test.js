/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 * Time Entry Test Runner — Phase 1 + Phase 2 Acceptance Tests
 * Trigger: Customization → Scripting → Script Deployments → Run Time Entry Tests → Save & Run
 * Results: Execution Log tab on the Script Deployment record
 */
define(['N/record', 'N/query', 'N/log', 'N/search', 'N/error'], (record, query, log, search, error) => {

    const RECORD_TYPE = 'customrecord_time_entry';
    const createdIds = [];
    const results = { pass: 0, fail: 0, tests: [] };

    /* ── helpers ─────────────────────────────────────────── */

    const pass = (name) => {
        results.pass++;
        results.tests.push({ name, status: 'PASS' });
        log.audit('PASS', name);
    };

    const fail = (name, reason) => {
        results.fail++;
        results.tests.push({ name, status: 'FAIL', reason });
        log.error('FAIL', `${name} — ${reason}`);
    };

    const getEmployeeId = () => {
        const s = search.create({ type: 'employee', filters: [['isinactive', 'is', 'F']], columns: ['internalid'] });
        const rows = s.run().getRange({ start: 0, end: 1 });
        if (!rows.length) throw error.create({ name: 'NO_EMPLOYEE', message: 'No active employee found' });
        return rows[0].getValue('internalid');
    };

    const createRecord = (fields) => {
        const rec = record.create({ type: RECORD_TYPE });
        Object.entries(fields).forEach(([k, v]) => rec.setValue({ fieldId: k, value: v }));
        return rec.save();
    };

    const deleteCreated = () => {
        createdIds.forEach(id => {
            try { record.delete({ type: RECORD_TYPE, id }); } catch (_) {}
        });
    };

    const today = () => new Date();

    const tomorrow = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
    };

    /* ── Phase 1 tests ───────────────────────────────────── */

    const tc01 = (employeeId) => {
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: today(),
                custrecord_te_hours:     8,
                custrecord_te_notes:     'TEST — valid record'
            });
            createdIds.push(id);
            pass('TC-01: Create valid record (8 hours, no project)');
            return id;
        } catch (e) { fail('TC-01: Create valid record', e.message); return null; }
    };

    const tc02 = (employeeId) => {
        try {
            const id = createRecord({ custrecord_te_employee: employeeId, custrecord_te_work_date: tomorrow(), custrecord_te_hours: 0 });
            createdIds.push(id);
            fail('TC-02: Hours = 0 should be rejected', 'Record was saved — validation did not fire');
        } catch (e) {
            e.message && e.message.includes('greater than 0')
                ? pass('TC-02: Hours = 0 rejected by UserEvent')
                : fail('TC-02: Hours = 0 rejected by UserEvent', `Unexpected error: ${e.message}`);
        }
    };

    const tc03 = (employeeId) => {
        try {
            const id = createRecord({ custrecord_te_employee: employeeId, custrecord_te_work_date: tomorrow(), custrecord_te_hours: -1 });
            createdIds.push(id);
            fail('TC-03: Negative hours should be rejected', 'Record was saved');
        } catch (e) {
            e.message && e.message.includes('greater than 0')
                ? pass('TC-03: Negative hours rejected by UserEvent')
                : fail('TC-03: Negative hours rejected by UserEvent', `Unexpected error: ${e.message}`);
        }
    };

    const tc04 = (employeeId) => {
        try {
            const id = createRecord({ custrecord_te_employee: employeeId, custrecord_te_work_date: tomorrow(), custrecord_te_hours: 25 });
            createdIds.push(id);
            fail('TC-04: Hours > 24 should be rejected', 'Record was saved');
        } catch (e) {
            e.message && e.message.includes('exceed 24')
                ? pass('TC-04: Hours > 24 rejected by UserEvent')
                : fail('TC-04: Hours > 24 rejected by UserEvent', `Unexpected error: ${e.message}`);
        }
    };

    const tc05 = (validId) => {
        if (!validId) { fail('TC-05: SuiteQL returns created record', 'Skipped — TC-01 failed'); return; }
        try {
            const rows = query.runSuiteQL({
                query: `SELECT id, custrecord_te_hours FROM customrecord_time_entry WHERE id = ? AND isinactive = 'F'`,
                params: [validId]
            }).asMappedResults();
            rows.length === 1 && parseFloat(rows[0].custrecord_te_hours) === 8
                ? pass('TC-05: SuiteQL returns correct hours for created record')
                : fail('TC-05: SuiteQL returns correct hours', `Got: ${JSON.stringify(rows)}`);
        } catch (e) { fail('TC-05: SuiteQL returns correct hours', e.message); }
    };

    const tc06 = () => {
        try {
            const rows = query.runSuiteQL({
                query: `SELECT COUNT(id) AS cnt FROM customrecord_time_entry WHERE isinactive = 'F' AND (custrecord_te_hours <= 0 OR custrecord_te_hours > 24)`
            }).asMappedResults();
            parseInt(rows[0].cnt, 10) === 0
                ? pass('TC-06: No records with invalid hours in database')
                : fail('TC-06: No records with invalid hours in database', `Found ${rows[0].cnt} record(s)`);
        } catch (e) { fail('TC-06: No records with invalid hours in database', e.message); }
    };

    /* ── Phase 2 tests ───────────────────────────────────── */

    const tc07 = (employeeId, firstId) => {
        // Duplicate: same employee, same date (today), no project — should fail
        if (!firstId) { fail('TC-07: Duplicate entry rejected', 'Skipped — TC-01 failed'); return; }
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: today(),
                custrecord_te_hours:     4
            });
            createdIds.push(id);
            fail('TC-07: Duplicate entry rejected', 'Duplicate record was saved');
        } catch (e) {
            e.message && e.message.includes('already exists')
                ? pass('TC-07: Duplicate entry (same employee + date + no project) rejected')
                : fail('TC-07: Duplicate entry rejected', `Unexpected error: ${e.message}`);
        }
    };

    const tc08 = (employeeId) => {
        // Different date → should succeed
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: tomorrow(),
                custrecord_te_hours:     6,
                custrecord_te_notes:     'TEST — different date'
            });
            createdIds.push(id);
            pass('TC-08: Same employee different date — allowed');
        } catch (e) { fail('TC-08: Same employee different date — allowed', e.message); }
    };

    const tc09 = (employeeId, firstId) => {
        // Edit own record without changing key fields → should NOT trigger duplicate error
        if (!firstId) { fail('TC-09: Edit own record allowed', 'Skipped — TC-01 failed'); return; }
        try {
            const rec = record.load({ type: RECORD_TYPE, id: firstId });
            rec.setValue({ fieldId: 'custrecord_te_notes', value: 'TEST — edited notes' });
            rec.save();
            pass('TC-09: Edit own record (notes only) — no false duplicate error');
        } catch (e) { fail('TC-09: Edit own record — no false duplicate error', e.message); }
    };

    /* ── entry point ─────────────────────────────────────── */

    const execute = () => {
        log.audit('═══ TEST RUN START ═══', `Time Entry Phase 1+2 — ${new Date().toISOString()}`);
        log.audit('Phase 1', '— Hours validation + SuiteQL');

        let employeeId;
        try {
            employeeId = getEmployeeId();
        } catch (e) {
            log.error('SETUP FAILED', e.message);
            return;
        }

        // Phase 1
        const validId = tc01(employeeId);
        tc02(employeeId);
        tc03(employeeId);
        tc04(employeeId);
        tc05(validId);
        tc06();

        log.audit('Phase 2', '— Duplicate check');

        // Phase 2
        tc07(employeeId, validId);
        tc08(employeeId);
        tc09(employeeId, validId);

        deleteCreated();

        log.audit('═══ TEST SUMMARY ═══', `PASS: ${results.pass} | FAIL: ${results.fail} | Total: ${results.tests.length}`);
        results.tests.forEach(t =>
            t.status === 'FAIL'
                ? log.error(`  [${t.status}]`, `${t.name}${t.reason ? ' — ' + t.reason : ''}`)
                : log.audit(`  [${t.status}]`, t.name)
        );

        if (results.fail > 0) {
            throw error.create({ name: 'TEST_FAILURES', message: `${results.fail} test(s) failed — see execution log` });
        }
    };

    return { execute };
});
