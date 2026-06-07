const currentStores = [];

export class AsyncLocalStorage {
  stores = currentStores;

  run(store, fn, ...args) {
    this.stores.push(store);
    try {
      return fn(...args);
    } finally {
      this.stores.pop();
    }
  }

  getStore() {
    return this.stores.at(-1);
  }
}

export default {
  AsyncLocalStorage,
};
