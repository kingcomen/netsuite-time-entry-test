/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/url', 'N/log'], (file, url, log) => {

    const HTML_PATH = '/SuiteScripts/time-entry/ui/te_app.html';

    const onRequest = ({ request, response }) => {
        try {
            const apiUrl = url.resolveScript({
                scriptId:     'customscript_sl_te_api',
                deploymentId: 'customdeploy_sl_te_api',
                returnExternalUrl: true
            });

            let html = file.load({ id: HTML_PATH }).getContents();
            html = html.replace(
                '</head>',
                `<script>window.TE_CONFIG=${JSON.stringify({ apiUrl })}</script></head>`
            );

            response.write({ output: html });
        } catch (e) {
            log.error('sl_te_ui', e.message);
            response.write({ output: `<pre>Error loading UI: ${e.message}</pre>` });
        }
    };

    return { onRequest };
});
