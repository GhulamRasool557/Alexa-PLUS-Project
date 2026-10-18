// A fake dashboard: polls /api/events like the website does.
function fakeScreen(base, id = 'test-screen') {
  let since = new Date(0).toISOString();
  const poll = async () => {
    const res = await fetch(`${base}/api/events?screen=${id}&since=${encodeURIComponent(since)}`).then((r) => r.json());
    since = res.now;
    return res.events;
  };
  return {
    connect: poll,
    // Waits for the next event of a type that arrived after the last poll.
    async next(type) {
      for (let i = 0; i < 20; i++) {
        const found = (await poll()).find((e) => e.type === type);
        if (found) return found.data;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`No ${type} event arrived`);
    },
  };
}

module.exports = { fakeScreen };
