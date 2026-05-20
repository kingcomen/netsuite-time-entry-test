/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([], () => {

    const beforeSubmit = (ctx) => {
        if (ctx.type !== ctx.UserEventType.CREATE && ctx.type !== ctx.UserEventType.EDIT) return;

        const rec = ctx.newRecord;
        const hours = parseFloat(rec.getValue('custrecord_te_hours'));

        if (isNaN(hours) || hours <= 0) {
            throw error.create({
                name: 'INVALID_HOURS',
                message: 'Hours must be greater than 0.',
                notifyOff: true
            });
        }

        if (hours > 24) {
            throw error.create({
                name: 'INVALID_HOURS',
                message: 'Hours cannot exceed 24 per day.',
                notifyOff: true
            });
        }
    };

    return { beforeSubmit };
});
