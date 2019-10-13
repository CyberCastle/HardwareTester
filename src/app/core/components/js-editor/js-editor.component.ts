import { Component, ViewEncapsulation, OnInit, NgZone } from '@angular/core'
import { Dialog, BrowserWindow, OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from 'electron'
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
import { Context } from 'vm'

@Component({
    selector: 'app-js-editor',
    templateUrl: './js-editor.component.html',
    styleUrls: ['./js-editor.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class JsEditorComponent implements OnInit {
    private electronBrowserWindow: typeof BrowserWindow
    private electronDialog: Dialog
    private scriptFilePath: string = null
    public scriptContent: string = null
    public scriptOutput: string = ''
    private static _scriptOutput: string = ''
    private safeEval: SafeEval
    private portService: SerialPortService

    constructor(private service: ElectronService, private ngZone: NgZone) {
        ;(<any>window).JSHINT = require('jshint').JSHINT
        this.electronBrowserWindow = service.remote.BrowserWindow
        this.electronDialog = service.remote.dialog

        const sandboxContext: Context = {
            ngZone: ngZone,
            portService: SerialPortService,
            console: {
                log: JsEditorComponent.writeOutput,
            },
        }

        this.safeEval = new SafeEval(this.portService, sandboxContext)
    }
    ngOnInit() {}

    handleChange($event: any) {
        //console.log('ngModelChange', $event)
    }

    openScript(): void {
        const openDialogOptions: OpenDialogOptions = {
            properties: ['openFile', 'treatPackageAsDirectory'],
            filters: [{ name: 'JS Scripts', extensions: ['js'] }],
        }

        this.electronDialog
            .showOpenDialog(this.electronBrowserWindow.getFocusedWindow(), openDialogOptions)
            .then((result: OpenDialogReturnValue) => {
                if (result.filePaths.length == 0) {
                    return
                }
                this._readScript(result.filePaths[0])
            })
            .catch((reason: any) => {
                console.error(reason)
            })
    }

    async saveScript(): Promise<boolean> {
        if (this.scriptFilePath) {
            this._writeScript()
            return
        }

        const saveDialogOptions: SaveDialogOptions = {
            filters: [{ name: 'JS Scripts', extensions: ['js'] }],
        }

        await this.electronDialog
            .showSaveDialog(this.electronBrowserWindow.getFocusedWindow(), saveDialogOptions)
            .then((result: SaveDialogReturnValue) => {
                if (result.canceled) {
                    return false
                }
                this.scriptFilePath = result.filePath
                this._writeScript()
            })
            .catch((reason: any) => {
                console.error(reason)
            })
        return false
    }

    async runScript() {
        if (this.scriptContent == null || this.scriptContent.length <= 4) {
            return
        }

        if (!this.scriptFilePath) {
            if (!(await this.saveScript())) {
                return
            }
        } else {
            await this._writeScript()
        }
        JsEditorComponent.writeOutput(this.safeEval.run(this.scriptContent))

        // More info here: https://stackoverflow.com/a/41255540/11454077
        this.ngZone.run(() => {
            this.scriptOutput = JsEditorComponent._scriptOutput
        })
    }

    stopScript(): void {
        this.safeEval.cancel()
    }

    formatScript(): void {
        if (this.scriptContent == null || this.scriptContent.length <= 4) {
            return
        }
        const prettierOptions: Options = {
            endOfLine: 'lf',
            parser: 'babel',
            printWidth: 140,
            tabWidth: 3,
            singleQuote: true,
        }
        this.scriptContent = format(this.scriptContent, prettierOptions)
    }

    clearOutput() {
        this.scriptOutput = ''
        JsEditorComponent._scriptOutput = ''
    }

    private static writeOutput(text: string) {
        if (JsEditorComponent._scriptOutput == '') {
            JsEditorComponent._scriptOutput = text
            return
        }

        JsEditorComponent._scriptOutput = JsEditorComponent._scriptOutput + '\n' + text
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

    private async _writeScript(): Promise<void> {
        const result: Promise<void> = new Promise((resolve, reject) => {
            writeFile(this.scriptFilePath, this.scriptContent, (error: NodeJS.ErrnoException) => {
                if (error) {
                    reject(error)
                }
                resolve()
            })
        })

        return result
    }
}
