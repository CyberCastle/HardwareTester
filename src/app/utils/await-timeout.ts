/**
 * Promise-based replacement for setTimeout / clearTimeout.
 * Piece of code obtain from here: https://github.com/vitalets/await-timeout
 */

export class Timeout {
    private _id: any
    private _delay: number

    constructor() {
        this._id = null
        this._delay = null
    }

    get id() {
        return this._id
    }

    get delay() {
        return this._delay
    }

    static sleep(ms_time: number): Promise<any> {
        return new Timeout().set(ms_time)
    }

    set(delay: number, rejectReason: any = ''): Promise<any> {
        return new Promise((resolve, reject) => {
            this.clear()
            const fn = rejectReason
                ? () => reject(this.toError(rejectReason))
                : resolve
            this._id = setTimeout(fn, delay)
            this._delay = delay
        })
    }

    wrap(promise: any, delay: any, rejectReason: any): Promise<any> {
        const wrappedPromise = this.promiseFinally(promise, () => this.clear())
        const timer = this.set(delay, rejectReason)
        return Promise.race([wrappedPromise, timer])
    }

    clear(): void {
        if (this._id) {
            clearTimeout(this._id)
        }
    }

    private promiseFinally(promise: any, fn: () => void): Promise<any> {
        const success = (result: any) => {
            fn()
            return result
        }
        const error = (e: any) => {
            fn()
            return Promise.reject(e)
        }
        return Promise.resolve(promise).then(success, error)
    }

    private toError(value: any): any {
        value = typeof value === 'function' ? value() : value
        return typeof value === 'string' ? new Error(value) : value
    }
}
