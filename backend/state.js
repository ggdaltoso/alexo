// In-memory state for Alexo backend
let state = {
  message: null,
};

function getState() {
  return state;
}

function updateMessage({ type, message }) {
  state.message = { type, message, timestamp: Date.now() };
}

module.exports = { getState, updateMessage };
