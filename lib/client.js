/**
 * dsh-termfleet client 半桩：浏览器半未开工（M0 仅 host 半探针）。
 * Fleet/任务/审计等面板开工后，在此提供真实入口，并在 package.json
 * 的 dsh.client 声明注入目标（形态参照 dsh-hippo lib/client.js）。
 */
export const client = {}
export default client
