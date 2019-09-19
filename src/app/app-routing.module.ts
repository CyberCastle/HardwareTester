import { NgModule } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'
import { MainSectionComponent } from './sections/main/main-section/main-section.component'

const routes: Routes = [
    {
        path: '',
        component: MainSectionComponent,
    },
    {
        path: '**',
        redirectTo: '/',
    },
]

@NgModule({
    imports: [RouterModule.forRoot(routes, { useHash: true })],
    exports: [RouterModule],
})
export class AppRoutingModule {}
