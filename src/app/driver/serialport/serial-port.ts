import { SerialPortService } from './serial-port.service'
import { Timeout } from '../../utils/await-timeout'
import * as SerialPort from 'serialport'

export abstract class SerialPortBase {
    private _port: SerialPort
    private buffer: Uint8Array
    private waitForResponseTime: number = 20

    protected constructor(private _portService: SerialPortService, private _portName: string, private _baudRate: number) {
        this.buffer = new Uint8Array(0)
    }

    protected async _connect(errorCallback?: SerialPortBase.ErrorCallback): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port = new this._portService.serialPort(
                this._portName,
                {
                    baudRate: this._baudRate,
                },
                error => {
                    if (error != undefined) {
                        reject(error)
                    }
                }
            )

            this._port.on('data', data => {
                this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length)
            })

            this._port.on('error', error => {
                if (errorCallback) {
                    errorCallback(error)
                }
            })

            this._port.on('open', data => {
                resolve()
            })
        })
    }

    protected _writeStr(data: string): Promise<void> {
        return this._write(Buffer.from(data))
    }

    protected async _write(data: Uint8Array): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port.write(Buffer.from(data), error => {
                if (error != undefined) {
                    reject(error)
                } else {
                    this._port.drain(error => {
                        if (error != undefined) {
                            reject(error)
                        } else {
                            resolve()
                        }
                    })
                }
            })
        })
    }

    protected async _read(waitTime: number = 0): Promise<Uint8Array> {
        await Timeout.sleep(waitTime < this.waitForResponseTime ? this.waitForResponseTime : waitTime)
        return new Promise<Uint8Array>((resolve, reject) => {
            const _buffer = this.buffer
            this.buffer = new Uint8Array(0)
            resolve(_buffer)
        })
    }

    protected async _clearBuffer(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port.flush(error => {
                this.buffer = new Uint8Array(0)
                if (error != undefined) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }

    public async close(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._port.close(error => {
                if (error != undefined) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
}

export declare namespace SerialPortBase {
    type ErrorCallback = (error?: Error | null) => void
}
