import { Component, ViewEncapsulation, OnInit, NgZone } from '@angular/core'
import { ElectronService } from '../../services'
import { SafeEval } from './safe-eval'
import { readFile, writeFile } from 'fs'
import { Options, format } from 'prettier'

// Hardware support
import { SerialPortService } from '../../../driver/serialport/serial-port.service'

// Codemirror imports
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/edit/trailingspace'
import 'codemirror/addon/fold/foldcode'
import 'codemirror/addon/fold/foldgutter'
import 'codemirror/addon/fold/brace-fold'
import 'codemirror/addon/hint/show-hint'
import 'codemirror/addon/hint/javascript-hint'
import 'codemirror/addon/lint/lint'
import 'codemirror/addon/lint/javascript-lint'
import 'codemirror/mode/javascript/javascript'

@Component({
    selector: 'app-js-editor',
    templateUrl: './js-editor.component.html',
    styleUrls: ['./js-editor.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class JsEditorComponent implements OnInit {
    private electronDialog: Electron.Dialog
    private scriptFilePath: string = null
    public scriptContent: string = null
    private safeEval: SafeEval
    private portService: SerialPortService

    constructor(private service: ElectronService, private ngZone: NgZone) {
        ;(<any>window).JSHINT = require('jshint').JSHINT
        this.electronDialog = service.remote.dialog
        this.safeEval = new SafeEval(this.portService)
    }
    ngOnInit() {
        console.log(process)

        console.log(global['window'])
    }

    handleChange($event: any) {
        //console.log('ngModelChange', $event)
    }

    openScript(): void {
        const openDialogOptions: Electron.OpenDialogOptions = {
            properties: ['openFile', 'treatPackageAsDirectory'],
            filters: [{ name: 'JS Scripts', extensions: ['js'] }],
        }

        this.electronDialog
            .showOpenDialog(openDialogOptions)
            .then((result: Electron.OpenDialogReturnValue) => {
                if (result.filePaths.length == 0) {
                    return
                }
                this._readScript(result.filePaths[0])
            })
            .catch((reason: any) => {
                console.error(reason)
            })
    }

    private _readScript(filePath: string) {
        readFile(filePath, 'utf-8', (err: NodeJS.ErrnoException, data: string) => {
            if (err) {
                alert('An error ocurred reading the file :' + err.message)
                return
            }

            // fs methods are executed outside angular zone.
            // More info here: https://stackoverflow.com/a/41255540/11454077
            this.ngZone.run(() => {
                this.scriptFilePath = filePath
                this.scriptContent = data
            })
        })
    }

    saveScript(): void {
        if (this.scriptFilePath) {
            this._writeScript()
            return
        }

        const saveDialogOptions: Electron.SaveDialogOptions = {
            filters: [{ name: 'JS Scripts', extensions: ['js'] }],
        }

        this.electronDialog
            .showSaveDialog(saveDialogOptions)
            .then((result: Electron.SaveDialogReturnValue) => {
                if (result.canceled) {
                    return
                }
                this.scriptFilePath = result.filePath
                this._writeScript()
            })
            .catch((reason: any) => {
                console.error(reason)
            })
    }

    private async _writeScript(): Promise<void> {
        const result: Promise<void> = new Promise((resolve, reject) => {
            writeFile(this.scriptFilePath, this.scriptContent, (error: NodeJS.ErrnoException) => {
                if (error) {
                    reject(error)
                }
                console.log('saved!!!')
                resolve()
            })
        })

        return result
    }

    async runScript() {
        await this._writeScript()
        if (!this.scriptFilePath) {
            return
        }
        const result = this.safeEval.run(this.scriptContent)
        console.log(result)
    }

    stopScript(): void {
        this.safeEval.cancel()
    }

    formatScript(): void {
        const prettierOptions: Options = {
            endOfLine: 'lf',
            parser: 'babel',
            printWidth: 140,
            tabWidth: 4,
            singleQuote: true,
        }
        this.scriptContent = format(this.scriptContent, prettierOptions)
    }
}