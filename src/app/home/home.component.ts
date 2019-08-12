import { Component, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material'
import { ElectronService } from '../core/services/electron/electron.service'
import { AboutComponent } from '../modal/about/about.component'

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
    constructor(private electron: ElectronService, public dialog: MatDialog) {}

    ngOnInit() {
        this.electron.serialPort
            .list()
            .then((ports: any) => {
                console.log(ports)
            })
            .catch((err: any) => {
                console.log(err)
            })
    }

    openAboutModal(): void {
        this.dialog.open(AboutComponent, {
            width: '250px',
        })
    }
}
