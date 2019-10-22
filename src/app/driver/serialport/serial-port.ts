import { SerialPortService } from './serial-port.service'
import * as SerialPort from 'serialport'

export abstract class SerialPortBase {
    private _port: SerialPort = null
    private waitForResponseTime: number = 2000 // 2 seconds for wait response.

    protected constructor(private _portService: SerialPortService, private _portName: string, private _baudRate: number) {}

    protected async _connect(errorCallback?: SerialPortBase.ErrorCallback): Promise<void> {
        if (this._port) {
            return Promise.reject(new Error('Connecting port failed. Port is open'))
        }
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
        if (!this._port) {
            return Promise.reject(new Error('Write data failed. Port is closed'))
        }
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

    protected async _read(numBytes: number): Promise<Uint8Array> {
        if (!this._port) {
            return Promise.reject(new Error('Read data failed. Port is closed'))
        }

        const timeCheckPoint: number = Date.now()
        const buffer: Buffer = Buffer.allocUnsafe(numBytes)
        let offset: number = 0
        try {
            while (true) {
                offset += (await this._port.binding.read(buffer, offset, numBytes - offset)).bytesRead
                if (offset === numBytes) break

                // Piece of code for kill infinite loop, by timeout
                if (Date.now() > timeCheckPoint + this.waitForResponseTime) {
                    return Promise.reject('Wait for response timed out, after 2 seconds')
                }
            }
        } catch (e) {
            return Promise.reject(e)
        }

        return Promise.resolve(buffer)
    }

    protected async _clearBuffer(): Promise<void> {
        if (!this._port) {
            return Promise.reject(new Error('Clear buffer failed. Port is closed'))
        }
        return new Promise<void>((resolve, reject) => {
            this._port.flush(error => {
                if (error != undefined) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }

    public async disconnect(): Promise<void> {
        if (!this._port) {
            return Promise.reject(new Error('Disconnecting port failed. Port is closed'))
        }
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
