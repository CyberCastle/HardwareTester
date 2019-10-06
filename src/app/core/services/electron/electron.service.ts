import { Injectable } from '@angular/core'

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import { ipcRenderer, webFrame, remote } from 'electron'

@Injectable({
    providedIn: 'root',
})
export class ElectronService {
    public ipcRenderer: typeof ipcRenderer
    public webFrame: typeof webFrame
    public remote: typeof remote

    get isElectron() {
        return window && window.process && window.process.type
    }

    constructor() {
        // Conditional imports
        if (this.isElectron) {
            this.ipcRenderer = window.require('electron').ipcRenderer
            this.webFrame = window.require('electron').webFrame
            this.remote = window.require('electron').remote
        }

        // Disable eval
        global.eval = function() {
            throw new Error(`Sorry, this app does not support window.eval().`)
        }
    }
}
