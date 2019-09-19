import { NgModule } from '@angular/core'
import { MatDialogModule, MatFormFieldModule, MatButtonModule, MatInputModule, MatGridListModule } from '@angular/material'

@NgModule({
    imports: [MatDialogModule, MatFormFieldModule, MatButtonModule, MatInputModule, MatGridListModule],
    exports: [MatDialogModule, MatFormFieldModule, MatButtonModule, MatInputModule, MatGridListModule],
})
export class AngularMaterialModule {}
