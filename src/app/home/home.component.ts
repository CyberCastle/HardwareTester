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

        var port = new this.electron.serialPort(
            '/dev/tty.usbmodemCK50952053FFFF1',
            {
                baudRate: 9600,
            },
            error => {
                if (error != undefined) {
                    console.log(error)
                }
            }
        )

        const parsers = this.electron.serialPort.parsers
        const parser = port.pipe(
            new parsers.Readline({
                delimiter: '\r\n',
            })
        )

        parser.on('data', function(data) {
            data = data.toString()
            console.log(data)
        })
    }

    openAboutModal(): void {
        this.dialog.open(AboutComponent, {
            width: '250px',
        })
    }
}
