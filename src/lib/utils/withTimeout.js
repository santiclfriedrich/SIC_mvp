// web/src/lib/utils/withTimeout.js

/**
 * Wraps any async function call with a hard timeout.
 * On timeout, rejects with an error that includes the provider name and TIMEOUT code.
 *
 * @param {() => Promise<any>} fn     - Zero-arg async factory (called inside)
 * @param {number}             ms     - Milliseconds before rejection (default: 3000)
 * @param {string}             name   - Provider name used in the error log
 * @returns {Promise<any>}
 */
export async function withTimeout(fn, ms = 3000, name = "unknown") {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timeout after ${ms}ms`);
      err.code = "TIMEOUT";
      err.provider = name;
      reject(err);
    }, ms);
  });

  try {
    const result = await Promise.race([fn(), timeout]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
