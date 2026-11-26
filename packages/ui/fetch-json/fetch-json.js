// Fetches JSON: the response's body, or an Error (with the response's
// `status`) when it isn't OK. One place for it, so modules don't each
// reimplement it, and tests mock this module instead of the global fetch.
const fetchJson = async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const error = new Error(`${url} failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
};

export { fetchJson };
