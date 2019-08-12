import { Component, OnInit, NgZone } from '@angular/core'
import { MatDialog } from '@angular/material'
import { ElectronService } from './core/services'
import { TranslateService } from '@ngx-translate/core'
import { AboutComponent } from './modal/about/about.component'

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
    constructor(
        public dialog: MatDialog,
        public ngZone: NgZone,
        public electronService: ElectronService,
        private translate: TranslateService
    ) {
        translate.setDefaultLang('en')
        if (electronService.isElectron) {
            console.log('Mode electron')
        } else {
            console.log('Mode web')
        }
    }

    ngOnInit() {
        this.electronService.ipcRenderer.on('openAboutModal', (event, arg) => {
            // Hack to access Angular functions
            setTimeout(() => {
                // Why use setTimeout method?????
                this.ngZone.run(() => {
                    this.openAboutModal()
                })
            })
        })
    }

    async openAboutModal() {
        this.dialog.open(AboutComponent, {
            width: '250px',
        })
    }
}
