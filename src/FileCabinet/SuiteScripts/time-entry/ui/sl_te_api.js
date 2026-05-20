/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/query', 'N/record', 'N/log', 'N/error'], (query, record, log, error) => {

    const RECORD_TYPE = 'customrecord_time_entry';

    const pad  = (n) => String(n).padStart(2, '0');
    const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const sql = (q, params) => {
        const res = params
            ? query.runSuiteQL({ query: q, params })
            : query.runSuiteQL({ query: q });
        return res.asMappedResults();
    };

    const writeJson = (res, data) =>
        res.write({ output: JSON.stringify(data) });

    /* ── actions ─────────────────────────────────────────── */

    const actions = {

        employees: () => sql(
            `SELECT id, entityid AS name FROM employee WHERE isinactive = 'F' ORDER BY entityid`
        ),

        projects: () => sql(
            `SELECT id, entityid AS name FROM job WHERE isinactive = 'F' ORDER BY entityid`
        ),

        list: ({ empId, page, pageSize }) => {
            const p    = Math.max(1, parseInt(page, 10) || 1);
            const ps   = Math.min(100, parseInt(pageSize, 10) || 20);
            const off  = (p - 1) * ps;

            const where = empId ? `AND r.custrecord_te_employee = ${parseInt(empId, 10)}` : '';

            const countRows = sql(`
                SELECT COUNT(r.id) AS cnt
                FROM customrecord_time_entry r
                WHERE r.isinactive = 'F' ${where}
            `);
            const total = parseInt(countRows[0].cnt, 10);

            const rows = sql(`
                SELECT
                    r.id,
                    TO_CHAR(r.custrecord_te_work_date, 'YYYY-MM-DD') AS work_date,
                    r.custrecord_te_hours       AS hours,
                    e.entityid                  AS employee,
                    j.entityid                  AS project,
                    r.custrecord_te_notes       AS notes
                FROM customrecord_time_entry r
                JOIN employee e ON e.id = r.custrecord_te_employee
                LEFT JOIN job j ON j.id = r.custrecord_te_project
                WHERE r.isinactive = 'F' ${where}
                ORDER BY r.custrecord_te_work_date DESC, r.id DESC
                OFFSET ${off} ROWS FETCH NEXT ${ps} ROWS ONLY
            `);

            return { rows, total, page: p, pageSize: ps };
        },

        summary: ({ empId }) => {
            if (!empId) return { today: 0, week: 0, month: 0, daily: [] };

            const id = parseInt(empId, 10);
            const now  = new Date();
            const todayStr  = toDateStr(now);

            const dow = now.getDay(); // 0=Sun
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - ((dow + 6) % 7)); // Mon
            const weekStartStr = toDateStr(weekStart);

            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthStartStr = toDateStr(monthStart);

            const agg = sql(`
                SELECT
                    TO_CHAR(r.custrecord_te_work_date, 'YYYY-MM-DD') AS d,
                    SUM(r.custrecord_te_hours) AS hrs
                FROM customrecord_time_entry r
                WHERE r.isinactive = 'F'
                  AND r.custrecord_te_employee = ?
                  AND r.custrecord_te_work_date >= TO_DATE('${monthStartStr}','YYYY-MM-DD')
                GROUP BY TO_CHAR(r.custrecord_te_work_date, 'YYYY-MM-DD')
                ORDER BY d
            `, [id]);

            const byDate = {};
            agg.forEach(row => { byDate[row.d] = parseFloat(row.hrs); });

            // 7-day daily array
            const daily = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const ds = toDateStr(d);
                daily.push({ date: ds, hours: byDate[ds] || 0 });
            }

            const todayHrs  = byDate[todayStr] || 0;
            const weekHrs   = Object.entries(byDate)
                .filter(([d]) => d >= weekStartStr && d <= todayStr)
                .reduce((s, [, h]) => s + h, 0);
            const monthHrs  = Object.values(byDate).reduce((s, h) => s + h, 0);

            return { today: todayHrs, week: weekHrs, month: monthHrs, daily };
        },

        report: () => {
            const rows = sql(`
                SELECT
                    COALESCE(j.entityid, '(No Project)') AS project,
                    SUM(r.custrecord_te_hours)            AS hours,
                    COUNT(r.id)                           AS entries
                FROM customrecord_time_entry r
                LEFT JOIN job j ON j.id = r.custrecord_te_project
                WHERE r.isinactive = 'F'
                GROUP BY j.entityid
                ORDER BY hours DESC
            `);

            const total = rows.reduce((s, r) => s + parseFloat(r.hours), 0);
            return rows.map(r => ({
                project: r.project,
                hours:   parseFloat(r.hours),
                entries: parseInt(r.entries, 10),
                pct:     total > 0 ? Math.round(parseFloat(r.hours) / total * 100) : 0
            }));
        },

        create: ({ empId, date, hours, projectId, notes }) => {
            const rec = record.create({ type: RECORD_TYPE });
            rec.setValue({ fieldId: 'custrecord_te_employee',  value: parseInt(empId, 10) });
            rec.setValue({ fieldId: 'custrecord_te_work_date', value: new Date(date + 'T12:00:00') });
            rec.setValue({ fieldId: 'custrecord_te_hours',     value: parseFloat(hours) });
            if (projectId) rec.setValue({ fieldId: 'custrecord_te_project', value: parseInt(projectId, 10) });
            if (notes)     rec.setValue({ fieldId: 'custrecord_te_notes',   value: notes });
            const id = rec.save();
            return { id };
        },

        delete: ({ id }) => {
            record.delete({ type: RECORD_TYPE, id: parseInt(id, 10) });
            return { ok: true };
        }
    };

    /* ── router ──────────────────────────────────────────── */

    const onRequest = ({ request, response }) => {
        response.setHeader({ name: 'Content-Type',                value: 'application/json' });
        response.setHeader({ name: 'Access-Control-Allow-Origin', value: '*' });

        const action = request.parameters.action;
        let body;
        if (request.method === 'POST') {
            try { body = JSON.parse(request.body || '{}'); } catch (_) { body = {}; }
        } else {
            body = request.parameters;
        }

        if (!action || !actions[action]) {
            return writeJson(response, { ok: false, error: `Unknown action: ${action}` });
        }

        try {
            const data = actions[action](body);
            writeJson(response, { ok: true, data });
        } catch (e) {
            log.error('sl_te_api', `action=${action} error=${e.message}`);
            writeJson(response, { ok: false, error: e.message });
        }
    };

    return { onRequest };
});
