import { Component, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material'
import { SerialPortService } from '../core/services/hardware/serial-port.service'
import { AboutComponent } from '../modal/about/about.component'

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
    constructor(
        private serialPortService: SerialPortService,
        public dialog: MatDialog
    ) {}

    ngOnInit() {
        this.serialPortService.serialPort
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

    // Example how read serial port
    readPort(): void {
        var port = new this.serialPortService.serialPort(
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

        const parsers = this.serialPortService.serialPort.parsers
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
}
