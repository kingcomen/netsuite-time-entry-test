/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/error', 'N/query'], (error, query) => {

    const validateHours = (hours) => {
        if (isNaN(hours) || hours <= 0) {
            throw error.create({ name: 'INVALID_HOURS', message: 'Hours must be greater than 0.', notifyOff: true });
        }
        if (hours > 24) {
            throw error.create({ name: 'INVALID_HOURS', message: 'Hours cannot exceed 24 per day.', notifyOff: true });
        }
    };

    const checkDuplicate = (rec, currentId) => {
        const employeeId = rec.getValue('custrecord_te_employee');
        const workDate   = rec.getValue('custrecord_te_work_date');
        const projectId  = rec.getValue('custrecord_te_project');

        if (!employeeId || !workDate) return; // mandatory check handles this

        const projectClause = projectId
            ? `AND r.custrecord_te_project = ${projectId}`
            : `AND r.custrecord_te_project IS NULL`;

        const excludeSelf = currentId ? `AND r.id <> ${currentId}` : '';

        // Format date to YYYY-MM-DD for SuiteQL
        const d = new Date(workDate);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const sql = `
            SELECT COUNT(r.id) AS cnt
            FROM customrecord_time_entry r
            WHERE r.isinactive = 'F'
              AND r.custrecord_te_employee = ${employeeId}
              AND TO_CHAR(r.custrecord_te_work_date, 'YYYY-MM-DD') = '${dateStr}'
              ${projectClause}
              ${excludeSelf}
        `;

        const rows = query.runSuiteQL({ query: sql }).asMappedResults();
        if (parseInt(rows[0].cnt, 10) > 0) {
            const proj = projectId ? ` / Project ID ${projectId}` : ' / No Project';
            throw error.create({
                name: 'DUPLICATE_TIME_ENTRY',
                message: `A Time Entry already exists for this Employee on ${dateStr}${proj}.`,
                notifyOff: true
            });
        }
    };

    const beforeSubmit = (ctx) => {
        if (ctx.type !== ctx.UserEventType.CREATE && ctx.type !== ctx.UserEventType.EDIT) return;

        const rec = ctx.newRecord;
        const hours = parseFloat(rec.getValue('custrecord_te_hours'));

        validateHours(hours);

        const currentId = ctx.type === ctx.UserEventType.EDIT ? rec.id : null;
        checkDuplicate(rec, currentId);
    };

    return { beforeSubmit };
});
