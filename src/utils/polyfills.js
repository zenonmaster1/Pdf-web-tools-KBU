// Polyfills for older mobile browsers (iOS 14+, older Android Chrome) and non-secure HTTP context

// 1. Promise.withResolvers (Required by pdfjs-dist on Safari < 17.4 and Chrome < 119)
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// 2. crypto.randomUUID (Unavailable in non-secure HTTP contexts like http://192.168.x.x)
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {}
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

// 3. structuredClone (Safari < 15.4, Chrome < 98)
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = function (obj) {
    if (obj === undefined) return undefined
    return JSON.parse(JSON.stringify(obj))
  }
}

// 4. Array.prototype.at (Safari < 15.4)
if (!Array.prototype.at) {
  Array.prototype.at = function (index) {
    const k = index >= 0 ? index : this.length + index
    return k >= 0 && k < this.length ? this[k] : undefined
  }
}

// 5. Object.hasOwn (Safari < 15.4)
if (!Object.hasOwn) {
  Object.hasOwn = function (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}
