import { Component, OnInit, Inject } from '@angular/core'
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'about-modal',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
    constructor(public dialogRef: MatDialogRef<AboutComponent>) {}

    close(): void {
        this.dialogRef.close()
    }

    ngOnInit() {}
}
