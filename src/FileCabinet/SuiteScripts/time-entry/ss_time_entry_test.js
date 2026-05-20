/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 * Time Entry Test Runner — Phase 1 Acceptance Tests
 * Trigger: Setup → Script Deployments → SS Time Entry Test → Run
 *
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
        if (!rows.length) throw error.create({ name: 'NO_EMPLOYEE', message: 'No active employee found for test' });
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

    /* ── tests ───────────────────────────────────────────── */

    const testCreateValid = (employeeId) => {
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: new Date(),
                custrecord_te_hours:     8,
                custrecord_te_notes:     'TEST — valid record'
            });
            createdIds.push(id);
            pass('TC-01: Create valid record (8 hours, no project)');
            return id;
        } catch (e) {
            fail('TC-01: Create valid record (8 hours, no project)', e.message);
            return null;
        }
    };

    const testHoursZero = (employeeId) => {
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: new Date(),
                custrecord_te_hours:     0
            });
            createdIds.push(id);
            fail('TC-02: Hours = 0 should be rejected', 'Record was saved — validation did not fire');
        } catch (e) {
            if (e.message && e.message.includes('greater than 0')) {
                pass('TC-02: Hours = 0 rejected by UserEvent');
            } else {
                fail('TC-02: Hours = 0 rejected by UserEvent', `Unexpected error: ${e.message}`);
            }
        }
    };

    const testHoursNegative = (employeeId) => {
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: new Date(),
                custrecord_te_hours:     -1
            });
            createdIds.push(id);
            fail('TC-03: Negative hours should be rejected', 'Record was saved — validation did not fire');
        } catch (e) {
            if (e.message && e.message.includes('greater than 0')) {
                pass('TC-03: Negative hours rejected by UserEvent');
            } else {
                fail('TC-03: Negative hours rejected by UserEvent', `Unexpected error: ${e.message}`);
            }
        }
    };

    const testHoursOver24 = (employeeId) => {
        try {
            const id = createRecord({
                custrecord_te_employee:  employeeId,
                custrecord_te_work_date: new Date(),
                custrecord_te_hours:     25
            });
            createdIds.push(id);
            fail('TC-04: Hours > 24 should be rejected', 'Record was saved — validation did not fire');
        } catch (e) {
            if (e.message && e.message.includes('exceed 24')) {
                pass('TC-04: Hours > 24 rejected by UserEvent');
            } else {
                fail('TC-04: Hours > 24 rejected by UserEvent', `Unexpected error: ${e.message}`);
            }
        }
    };

    const testSuiteQL = (validId) => {
        if (!validId) { fail('TC-05: SuiteQL returns created record', 'Skipped — TC-01 failed'); return; }
        try {
            const res = query.runSuiteQL({
                query: `SELECT id, custrecord_te_hours FROM customrecord_time_entry WHERE id = ? AND isinactive = 'F'`,
                params: [validId]
            });
            const rows = res.asMappedResults();
            if (rows.length === 1 && parseFloat(rows[0].custrecord_te_hours) === 8) {
                pass('TC-05: SuiteQL returns correct hours for created record');
            } else {
                fail('TC-05: SuiteQL returns correct hours for created record', `Got: ${JSON.stringify(rows)}`);
            }
        } catch (e) {
            fail('TC-05: SuiteQL returns correct hours for created record', e.message);
        }
    };

    const testSuiteQLNoInvalidHours = () => {
        try {
            const res = query.runSuiteQL({
                query: `SELECT COUNT(id) AS cnt FROM customrecord_time_entry WHERE isinactive = 'F' AND (custrecord_te_hours <= 0 OR custrecord_te_hours > 24)`
            });
            const cnt = parseInt(res.asMappedResults()[0].cnt, 10);
            if (cnt === 0) {
                pass('TC-06: No records with invalid hours in database');
            } else {
                fail('TC-06: No records with invalid hours in database', `Found ${cnt} record(s) with hours outside 0–24`);
            }
        } catch (e) {
            fail('TC-06: No records with invalid hours in database', e.message);
        }
    };

    /* ── entry point ─────────────────────────────────────── */

    const execute = () => {
        log.audit('TEST RUN START', `Time Entry Phase 1 — ${new Date().toISOString()}`);

        let employeeId;
        try {
            employeeId = getEmployeeId();
        } catch (e) {
            log.error('SETUP FAILED', e.message);
            return;
        }

        const validId = testCreateValid(employeeId);
        testHoursZero(employeeId);
        testHoursNegative(employeeId);
        testHoursOver24(employeeId);
        testSuiteQL(validId);
        testSuiteQLNoInvalidHours();

        deleteCreated();

        log.audit('TEST SUMMARY', `PASS: ${results.pass} | FAIL: ${results.fail} | Total: ${results.tests.length}`);
        results.tests.forEach(t => {
            if (t.status === 'FAIL') log.error(`  [${t.status}]`, `${t.name}${t.reason ? ' — ' + t.reason : ''}`);
            else log.audit(`  [${t.status}]`, t.name);
        });

        if (results.fail > 0) {
            throw error.create({ name: 'TEST_FAILURES', message: `${results.fail} test(s) failed — see logs above` });
        }
    };

    return { execute };
});
