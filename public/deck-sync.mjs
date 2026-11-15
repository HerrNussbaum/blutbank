// Serialize account writes per deck and debounce edits without delaying local saves.

export function createDeckSync({ loadDeck, saveDeck, onStatus = () => {}, delay = 900 }) {
  const jobs = new Map();
  let user = null;
  const emit = (id, status, error = '') => onStatus(id, { status, error });

  function setUser(next) {
    const id = next?.id || null;
    if (user !== id) {
      for (const job of jobs.values()) {
        clearTimeout(job.timer);
        job.pending = false;
      }
      jobs.clear();
    }
    user = id;
  }

  async function flush(id) {
    const job = jobs.get(id);
    if (!job || !user || job.owner !== user) return;
    clearTimeout(job.timer);
    if (job.running) {
      job.pending = true;
      return job.running;
    }
    job.pending = false;
    const deck = loadDeck(id);
    if (!deck) return;
    const owner = user;
    emit(id, 'saving');
    job.running = (async () => {
      try {
        await saveDeck(deck, owner);
        if (user === owner && jobs.get(id) === job) emit(id, 'saved');
      } catch (e) {
        job.pending = false;
        if (user === owner && jobs.get(id) === job) emit(id, 'error', e.message);
      } finally {
        job.running = null;
        if (job.pending && user === owner && jobs.get(id) === job) await flush(id);
      }
    })();
    return job.running;
  }

  function schedule(id) {
    if (!user) {
      emit(id, 'local');
      return;
    }
    let job = jobs.get(id);
    if (!job) {
      job = { owner: user, timer: null, running: null, pending: false };
      jobs.set(id, job);
    }
    clearTimeout(job.timer);
    emit(id, 'pending');
    if (job.running) {
      job.pending = true;
      return;
    }
    job.timer = setTimeout(() => flush(id), delay);
  }
  return { setUser, schedule, flush };
}
