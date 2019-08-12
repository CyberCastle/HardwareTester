import 'reflect-metadata'
import '../polyfills'

import { BrowserModule } from '@angular/platform-browser'
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClientModule, HttpClient } from '@angular/common/http'
import { CoreModule } from './core/core.module'
import { AngularMaterialModule } from './core/angular-material.module'
import { SharedModule } from './shared/shared.module'

import { AppRoutingModule } from './app-routing.module'

// NG Translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core'
import { TranslateHttpLoader } from '@ngx-translate/http-loader'

import { HomeModule } from './home/home.module'
import { AppComponent } from './app.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

// Modals
import { AboutComponent } from './modal/about/about.component'

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json')
}

@NgModule({
    declarations: [AppComponent, AboutComponent],
    imports: [
        BrowserModule,
        FormsModule,
        HttpClientModule,
        CoreModule,
        SharedModule,
        HomeModule,
        AppRoutingModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient],
            },
        }),
        AngularMaterialModule,
        BrowserAnimationsModule,
    ],
    providers: [],
    bootstrap: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    entryComponents: [AboutComponent],
})
export class AppModule {}
