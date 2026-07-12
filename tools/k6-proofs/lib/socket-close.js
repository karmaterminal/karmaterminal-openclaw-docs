export function closeSocketAfterDelay(socket, delayMs, beforeClose = () => {}) {
  const delay = Number(delayMs);
  if (!Number.isFinite(delay)) throw new Error(`invalid socket close delay: ${delayMs}`);

  const close = () => {
    beforeClose();
    socket.close();
  };

  if (delay <= 0) {
    close();
    return false;
  }

  socket.setTimeout(close, delay);
  return true;
}
